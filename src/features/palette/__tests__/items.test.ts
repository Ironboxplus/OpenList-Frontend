import * as i18n from "@solid-primitives/i18n"
import { describe, expect, it, vi } from "vitest"
import { dict } from "~/lang/en/entry"
import { UserRole } from "~/types"
import {
  buildPaletteItems,
  emptyQueryList,
  type PaletteContext,
} from "../items"
import { rankAll } from "../rank"

const flat = i18n.flatten(dict) as unknown as Record<string, string>
const t = (key: string) => flat[key] ?? key

const ADMIN = { role: UserRole.ADMIN, permission: 0 }
const GENERAL = { role: UserRole.GENERAL, permission: 0 }
const GUEST = { role: UserRole.GUEST, permission: 0 }

const ctx = (over: Partial<PaletteContext> = {}): PaletteContext => ({
  user: ADMIN,
  t,
  syncAvailable: true,
  go: vi.fn(),
  newSync: vi.fn(),
  openTaskCenter: vi.fn(),
  toggleTheme: vi.fn(),
  toggleLanguage: vi.fn(),
  ...over,
})

const ids = (c: PaletteContext) => buildPaletteItems(c).map((i) => i.id)

describe("buildPaletteItems", () => {
  it("gives an admin navigation, every setting and all four actions", () => {
    const list = ids(ctx())
    expect(list).toEqual(
      expect.arrayContaining([
        "nav:files",
        "nav:transfers",
        "nav:settings",
        "setting:traffic",
        "setting:cluster",
        "action:new-sync",
        "action:task-center",
        "action:toggle-theme",
        "action:toggle-language",
      ]),
    )
  })

  it("lists Transfers once: the navigation entry, not the settings duplicate", () => {
    expect(ids(ctx()).filter((i) => i.endsWith("transfers"))).toEqual([
      "nav:transfers",
    ])
  })

  it("offers New sync job only to an admin on a backend with the sync API", () => {
    expect(ids(ctx())).toContain("action:new-sync")
    expect(ids(ctx({ syncAvailable: false }))).not.toContain("action:new-sync")
    expect(ids(ctx({ user: GENERAL }))).not.toContain("action:new-sync")
  })

  it("filters settings by permission", () => {
    const general = ids(ctx({ user: GENERAL }))
    expect(general).toContain("setting:shares")
    expect(general).not.toContain("setting:traffic")
    expect(general).not.toContain("setting:users")
    const delegated = ids(
      ctx({ user: { role: UserRole.GENERAL, permission: 1 << 16 } }),
    )
    expect(delegated).toContain("setting:users")
  })

  it("shows a guest only the files page and the generic actions", () => {
    const guest = ids(ctx({ user: GUEST }))
    expect(guest).toContain("nav:files")
    expect(guest).not.toContain("nav:settings")
    expect(guest).not.toContain("nav:transfers")
    expect(guest).not.toContain("action:task-center")
    expect(guest).toContain("action:toggle-theme")
  })

  it("wires run() to the matching effect", () => {
    const c = ctx()
    const by = (id: string) => buildPaletteItems(c).find((i) => i.id === id)!
    by("action:new-sync").run()
    expect(c.newSync).toHaveBeenCalled()
    by("action:task-center").run()
    expect(c.openTaskCenter).toHaveBeenCalled()
    by("action:toggle-theme").run()
    expect(c.toggleTheme).toHaveBeenCalled()
    by("action:toggle-language").run()
    expect(c.toggleLanguage).toHaveBeenCalled()
    by("nav:files").run()
    expect(c.go).toHaveBeenLastCalledWith("/")
    by("setting:traffic").run()
    expect(c.go).toHaveBeenLastCalledWith("/@manage/settings/traffic")
    by("setting:cluster").run()
    expect(c.go).toHaveBeenLastCalledWith("/@manage/plugins#cluster")
  })

  it("opens the docs entry in a new tab instead of routing", () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null)
    const c = ctx()
    buildPaletteItems(c)
      .find((i) => i.id === "setting:docs")!
      .run()
    expect(open).toHaveBeenCalled()
    expect(c.go).not.toHaveBeenCalled()
    open.mockRestore()
  })
})

describe("searching the palette (acceptance phrases)", () => {
  const items = buildPaletteItems(ctx())
  const top = (q: string) => rankAll(q, items)[0]?.id

  it("限速 reaches the traffic page first", () => {
    expect(top("限速")).toBe("setting:traffic")
  })
  it("bandwidth reaches the traffic page first", () => {
    expect(top("bandwidth")).toBe("setting:traffic")
  })
  it("同步 offers New sync job", () => {
    expect(rankAll("同步", items).map((i) => i.id)).toContain("action:new-sync")
  })
  it("新建同步 puts New sync job first", () => {
    expect(top("新建同步")).toBe("action:new-sync")
  })
  it("oidc reaches Single Sign-On", () => {
    expect(top("oidc")).toBe("setting:sso")
  })
  it("cluster has its own direct entry", () => {
    expect(top("cluster")).toBe("setting:cluster")
  })
  it("dark finds the theme toggle", () => {
    expect(top("dark")).toBe("action:toggle-theme")
  })
  it("pinyin initials do not find the Chinese-named page", () => {
    expect(rankAll("xs", items).map((i) => i.id)).not.toContain(
      "setting:traffic",
    )
    expect(rankAll("xiansu", items).map((i) => i.id)).not.toContain(
      "setting:traffic",
    )
  })
})

describe("emptyQueryList", () => {
  const items = buildPaletteItems(ctx())
  it("puts recent first, skips unavailable ids, and omits settings otherwise", () => {
    const rows = emptyQueryList(items, ["setting:traffic", "gone", "nav:files"])
    expect(rows.slice(0, 2).map((r) => r.item.id)).toEqual([
      "setting:traffic",
      "nav:files",
    ])
    expect(rows.slice(0, 2).every((r) => r.recent)).toBe(true)
    const rest = rows.slice(2)
    expect(rest.every((r) => !r.recent)).toBe(true)
    expect(rest.some((r) => r.item.group === "setting")).toBe(false)
    expect(rest.map((r) => r.item.id)).not.toContain("nav:files")
  })
  it("lists navigation and actions without history", () => {
    const rows = emptyQueryList(items, [])
    expect(rows.every((r) => r.item.group !== "setting")).toBe(true)
    expect(rows.length).toBeGreaterThan(3)
  })
})
