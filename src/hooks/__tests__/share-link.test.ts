import { describe, expect, it, vi } from "vitest"

let cookie = ""
vi.mock("@solid-primitives/storage", () => ({
  cookieStorage: { getItem: () => cookie },
}))
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
import { getLinkByDirAndObj } from "../useLink"

const obj = { name: "v.mkv" } as Obj

describe("share direct link password", () => {
  const passwords = [
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
      cookie = pwd
      const link = getLinkByDirAndObj("/@s/sid", obj, "direct", true, true)
      const u = new URL(link)
      expect(u.searchParams.get("pwd")).toBe(pwd)
      expect(u.hash).toBe("")
      expect(u.pathname.endsWith("/sd/sid/v.mkv")).toBe(true)
    }
  })

  it("adds no pwd without a password", () => {
    cookie = ""
    expect(
      getLinkByDirAndObj("/@s/sid", obj, "direct", true, true),
    ).not.toContain("pwd")
  })

  it("still gives an mpv command with nothing unsafe inside the quotes", () => {
    for (const pwd of passwords.concat(['q"$`\!'])) {
      cookie = pwd
      const link = getLinkByDirAndObj("/@s/sid", obj, "direct", true, true)
      const cmd = mpvCommand([{ url: link, subUrls: [link] }])
      for (const m of cmd.matchAll(/"([^"]*)"/g)) {
        expect(m[1]).not.toMatch(/["$`\!]/)
      }
    }
  })
})
