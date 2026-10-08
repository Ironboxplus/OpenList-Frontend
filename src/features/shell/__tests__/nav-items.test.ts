import { describe, expect, it } from "vitest"
import { User, UserRole } from "~/types"
import {
  activeNavId,
  badgeTarget,
  navItemsFor,
  readCollapsed,
  writeCollapsed,
} from "../nav-items"

const user = (role: UserRole): User => ({
  id: 1,
  username: "u",
  password: "",
  base_path: "/",
  role,
  permission: 0,
  sso_id: "",
  disabled: false,
  allow_ldap: false,
})

const ids = (u: User, area?: "main" | "secondary") =>
  navItemsFor(u, area).map((i) => i.id)

describe("navItemsFor", () => {
  it.each([
    ["admin", UserRole.ADMIN, ["files", "transfers", "settings"]],
    ["general", UserRole.GENERAL, ["files", "transfers", "settings"]],
    ["guest", UserRole.GUEST, ["files"]],
  ])("%s sees %j", (_n, role, expected) => {
    expect(ids(user(role))).toEqual(expected)
  })

  it("splits main and secondary areas", () => {
    expect(ids(user(UserRole.ADMIN), "main")).toEqual(["files", "transfers"])
    expect(ids(user(UserRole.ADMIN), "secondary")).toEqual(["settings"])
  })

  it("never lists settings for a guest in any area", () => {
    expect(ids(user(UserRole.GUEST), "secondary")).toEqual([])
  })
})

describe("activeNavId", () => {
  it.each([
    ["/", "files"],
    ["/movies/a b", "files"],
    ["/@transfers", "transfers"],
    ["/@transfers/", "transfers"],
    ["/@manage", "settings"],
    ["/@manage/storages", "settings"],
    ["/@manage/tasks/copy", "settings"],
    ["/@login", undefined],
    ["/@s/abc", undefined],
    ["/@transfersX", undefined],
  ])("%s -> %s", (path, expected) => {
    expect(activeNavId(path)).toBe(expected)
  })
})

describe("badgeTarget", () => {
  it("attaches the transfer badge to the transfers item only", () => {
    expect(badgeTarget("transfers")).toBe(true)
    expect(badgeTarget("files")).toBe(false)
    expect(badgeTarget("settings")).toBe(false)
  })
})

describe("collapsed persistence", () => {
  const mem = () => {
    const m = new Map<string, string>()
    return {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => void m.set(k, v),
    }
  }
  it("defaults to expanded", () => {
    expect(readCollapsed(mem())).toBe(false)
  })
  it("round-trips", () => {
    const s = mem()
    writeCollapsed(s, true)
    expect(readCollapsed(s)).toBe(true)
    writeCollapsed(s, false)
    expect(readCollapsed(s)).toBe(false)
  })
  it("survives a storage that throws", () => {
    const bad = {
      getItem: () => {
        throw new Error("denied")
      },
      setItem: () => {
        throw new Error("denied")
      },
    }
    expect(readCollapsed(bad)).toBe(false)
    expect(() => writeCollapsed(bad, true)).not.toThrow()
  })
})
