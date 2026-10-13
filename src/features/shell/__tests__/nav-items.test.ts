import { describe, expect, it, vi } from "vitest"
import { User, UserRole } from "~/types"
import {
  activeNavId,
  badgeTarget,
  NAV_ITEMS,
  navItemsFor,
  phoneTabItems,
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

const on = { mediaEnabled: true }
const off = { mediaEnabled: false }

const ids = (u: User, area?: "main" | "secondary", env = on) =>
  navItemsFor(u, area, env).map((i) => i.id)

const SIGNED_IN = [
  "dashboard",
  "files",
  "media",
  "transfers",
  "plugins",
  "settings",
]

describe("navItemsFor", () => {
  it.each([
    ["admin", UserRole.ADMIN, SIGNED_IN],
    ["general", UserRole.GENERAL, SIGNED_IN],
    ["guest", UserRole.GUEST, ["files"]],
  ])("%s sees %j", (_n, role, expected) => {
    expect(ids(user(role))).toEqual(expected)
  })

  it("hides media when the media switch is off, for everyone", () => {
    for (const role of [UserRole.ADMIN, UserRole.GENERAL]) {
      expect(ids(user(role), undefined, off)).toEqual(
        SIGNED_IN.filter((i) => i !== "media"),
      )
    }
    expect(ids(user(UserRole.GUEST), undefined, off)).toEqual(["files"])
  })

  it("splits main and secondary areas", () => {
    expect(ids(user(UserRole.ADMIN), "main")).toEqual([
      "dashboard",
      "files",
      "media",
      "transfers",
      "plugins",
    ])
    expect(ids(user(UserRole.ADMIN), "secondary")).toEqual(["settings"])
  })

  it("never lists settings for a guest in any area", () => {
    expect(ids(user(UserRole.GUEST), "secondary")).toEqual([])
  })
})

describe("phoneTabItems", () => {
  const phone = (u: User, env = on) => phoneTabItems(u, env).map((i) => i.id)
  it("holds the four high-frequency entries", () => {
    expect(phone(user(UserRole.GENERAL))).toEqual([
      "dashboard",
      "files",
      "media",
      "transfers",
    ])
  })
  it("drops media with the switch and shrinks a guest to files", () => {
    expect(phone(user(UserRole.GENERAL), off)).toEqual([
      "dashboard",
      "files",
      "transfers",
    ])
    expect(phone(user(UserRole.GUEST))).toEqual(["files"])
  })
  it("never has more than four", () => {
    expect(NAV_ITEMS.filter((i) => i.phone).length).toBeLessThanOrEqual(4)
  })
})

describe("activeNavId", () => {
  it.each([
    ["/", "files"],
    ["/movies/a b", "files"],
    ["/@dashboard", "dashboard"],
    ["/@media", "media"],
    ["/@media/", "media"],
    ["/@plugins", "plugins"],
    ["/@transfers", "transfers"],
    ["/@transfers/", "transfers"],
    ["/@manage", "settings"],
    ["/@manage/storages", "settings"],
    ["/@manage/tasks/copy", "settings"],
    ["/@login", undefined],
    ["/@s/abc", undefined],
    ["/@transfersX", undefined],
    ["/@mediaX", undefined],
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

describe("section preloading", () => {
  it("has one loader per nav id, including the settings and files pages", async () => {
    const { SECTION_LOADERS, NAV_ITEMS } = await import("../nav-items")
    for (const i of NAV_ITEMS)
      expect(SECTION_LOADERS[i.id]).toBeTypeOf("function")
  })

  it("falls back to a timer when requestIdleCallback is missing, and can be cancelled", async () => {
    vi.useFakeTimers()
    const { preloadAllSections, SECTION_LOADERS } = await import("../nav-items")
    const spy = vi
      .spyOn(SECTION_LOADERS, "transfers")
      .mockResolvedValue({ default: () => null })
    const old = (globalThis as any).requestIdleCallback
    ;(globalThis as any).requestIdleCallback = undefined
    const cancel = preloadAllSections(["transfers"])
    expect(spy).not.toHaveBeenCalled()
    vi.advanceTimersByTime(300)
    expect(spy).toHaveBeenCalledTimes(1)
    preloadAllSections(["transfers"])()
    vi.advanceTimersByTime(300)
    expect(spy).toHaveBeenCalledTimes(1)
    cancel()
    ;(globalThis as any).requestIdleCallback = old
    vi.useRealTimers()
  })
})
