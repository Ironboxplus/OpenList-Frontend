import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("~/store", () => ({
  objStore: {},
  password: () => "",
  selectedObjs: () => [],
  State: { File: 2 },
  me: () => ({ base_path: "/" }),
}))
vi.mock(".", () => ({ useRouter: vi.fn(), useT: vi.fn(), useUtil: vi.fn() }))

import { Obj } from "~/types"
import { mpvCommand } from "~/utils/mpv-command"
import { setShareToken } from "~/utils/share-auth"
import { getLinkByDirAndObj } from "../useLink"

let cookie = ""
beforeEach(() => {
  localStorage.clear()
  cookie = ""
})
const setToken = (t: string) => {
  cookie = t
  if (t) setShareToken("sid", t)
}

const obj = { name: "v.mkv" } as Obj

describe("share direct link token", () => {
  const passwords = [
    "x.y-z_0",
    "a&b",
    "a#b",
    "a+b",
    "a?b",
    "a b",
    "密码",
    "x=1&y=2#z+ ?中",
    "100%",
  ]

  it("round-trips through the query string", () => {
    for (const pwd of passwords) {
      setToken(pwd)
      const link = getLinkByDirAndObj("/@s/sid", obj, "direct", true, true)
      const u = new URL(link)
      expect(u.searchParams.get("auth")).toBe(pwd)
      expect(u.searchParams.has("pwd")).toBe(false)
      expect(u.hash).toBe("")
      expect(u.pathname.endsWith("/sd/sid/v.mkv")).toBe(true)
    }
  })

  it("adds no auth without a token", () => {
    setToken("")
    expect(
      getLinkByDirAndObj("/@s/sid", obj, "direct", true, true),
    ).not.toContain("auth")
  })

  it("still gives an mpv command with nothing unsafe inside the quotes", () => {
    for (const pwd of passwords.concat(['q"$`\!'])) {
      setToken(pwd)
      const link = getLinkByDirAndObj("/@s/sid", obj, "direct", true, true)
      const cmd = mpvCommand([{ url: link, subUrls: [link] }])
      for (const m of cmd.matchAll(/"([^"]*)"/g)) {
        expect(m[1]).not.toMatch(/["$`\!]/)
      }
    }
  })

  it("marks a preview link and keeps downloads unmarked", () => {
    setToken("tok")
    const dl = getLinkByDirAndObj("/@s/sid", obj, "direct", true, true)
    const pv = getLinkByDirAndObj("/@s/sid", obj, "direct", true, true, {
      preview: true,
    })
    expect(new URL(dl).searchParams.has("preview")).toBe(false)
    const u = new URL(pv)
    expect(u.searchParams.get("preview")).toBe("1")
    expect(u.searchParams.get("auth")).toBe("tok")
    // outside a share the flag means nothing
    expect(
      getLinkByDirAndObj("/a", obj, "direct", false, true, { preview: true }),
    ).not.toContain("preview")
  })
})
