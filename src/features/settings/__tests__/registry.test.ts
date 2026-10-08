import * as i18n from "@solid-primitives/i18n"
import { describe, expect, it } from "vitest"
import { dict } from "~/lang/en/entry"
import zhCenter from "~/lang/zh-CN/settings_center.json"
import { routeComponents } from "~/pages/manage/route-components"
import { UserRole } from "~/types"
import {
  canAccess,
  groupSettings,
  manageSubPath,
  SETTING_GROUPS,
  SETTINGS,
  visibleSettings,
} from "../registry"

/**
 * Every address the old Manage sidebar linked to (profile and "home" are not
 * settings: profile moved to the account menu, home is plain navigation).
 * Adding a page without a registry entry, or dropping one, fails here.
 */
const LEGACY_ROUTES = [
  "/@manage/dashboard",
  "/@manage/settings/site",
  "/@manage/settings/style",
  "/@manage/settings/preview",
  "/@manage/settings/global",
  "/@manage/settings/sso",
  "/@manage/settings/ldap",
  "/@manage/settings/s3",
  "/@manage/settings/ftp",
  "/@manage/settings/traffic",
  "/@manage/settings/other",
  "/@manage/users",
  "/@manage/storages",
  "/@manage/shares",
  "/@manage/plugins",
  "/@manage/metas",
  "/@manage/indexes",
  "/@manage/backup-restore",
  "/@manage/about",
  "https://doc.oplist.org",
]

const user = (role: UserRole, permission = 0) => ({ role, permission })
const ADMIN = user(UserRole.ADMIN)
const GENERAL = user(UserRole.GENERAL)
const GUEST = user(UserRole.GUEST)
const DELEGATED = user(UserRole.GENERAL, 1 << 16)

const flat = i18n.flatten(dict) as unknown as Record<string, string>
const flatZh = i18n.flatten(zhCenter) as unknown as Record<string, string>

describe("registry integrity", () => {
  it("has an entry for every legacy route", () => {
    const routes = new Set(SETTINGS.map((s) => s.route))
    for (const r of LEGACY_ROUTES) expect(routes.has(r), r).toBe(true)
  })

  it("adds the transfers page and a direct cluster entry", () => {
    const routes = SETTINGS.map((s) => s.route)
    expect(routes).toContain("/@transfers")
    expect(routes).toContain("/@manage/plugins#cluster")
  })

  it("does not list the profile page", () => {
    expect(SETTINGS.some((s) => s.route === "/@manage/profile")).toBe(false)
    expect(SETTINGS.some((s) => s.route === "/@manage")).toBe(false)
  })

  it("has unique ids and unique routes", () => {
    const ids = SETTINGS.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
    const routes = SETTINGS.map((s) => s.route)
    expect(new Set(routes).size).toBe(routes.length)
  })

  it("uses six groups, all non-empty, every item in a known group", () => {
    expect(SETTING_GROUPS).toHaveLength(6)
    const known = new Set(SETTING_GROUPS.map((g) => g.id))
    for (const s of SETTINGS) expect(known.has(s.group), s.id).toBe(true)
    for (const g of SETTING_GROUPS) {
      expect(
        SETTINGS.some((s) => s.group === g.id),
        g.id,
      ).toBe(true)
    }
  })

  it("places entries in the planned groups", () => {
    const group = (id: string) => SETTINGS.find((s) => s.id === id)!.group
    expect(["site", "style", "preview", "other"].map(group)).toEqual(
      Array(4).fill("site"),
    )
    expect(
      ["storages", "shares", "traffic", "s3", "ftp", "transfers"].map(group),
    ).toEqual(Array(6).fill("storage"))
    expect(group("indexes")).toBe("indexing")
    expect(["users", "metas", "sso", "ldap"].map(group)).toEqual(
      Array(4).fill("access"),
    )
    expect(["plugins", "cluster"].map(group)).toEqual(
      Array(2).fill("extensions"),
    )
    expect(
      ["global", "dashboard", "backup-restore", "about", "docs"].map(group),
    ).toEqual(Array(5).fill("system"))
  })

  it("only external entries carry full URLs, the rest are site routes", () => {
    for (const s of SETTINGS) {
      if (s.external) expect(s.route, s.id).toMatch(/^https:\/\//)
      else expect(s.route, s.id).toMatch(/^\/@/)
    }
  })

  it("every /@manage route has a page component", () => {
    for (const s of SETTINGS) {
      const sub = manageSubPath(s.route)
      if (sub) expect(routeComponents[sub], s.route).toBeTypeOf("function")
    }
  })

  it("has en and zh-CN strings for every group and item", () => {
    const keys = [
      ...SETTING_GROUPS.map((g) => g.title),
      ...SETTINGS.flatMap((s) => [s.title, s.description]),
    ]
    for (const k of keys) {
      expect(flat[k], `en ${k}`).toBeTruthy()
      expect(flatZh[k.replace(/^settings\./, "")], `zh ${k}`).toBeTruthy()
    }
  })

  it("keeps keywords bilingual and pointed at inner setting names", () => {
    const kw = (id: string) => SETTINGS.find((s) => s.id === id)!.keywords
    expect(kw("traffic")).toEqual(expect.arrayContaining(["限速", "bandwidth"]))
    expect(kw("sso")).toEqual(expect.arrayContaining(["oidc", "github"]))
    expect(kw("transfers")).toEqual(expect.arrayContaining(["同步", "sync"]))
    for (const s of SETTINGS) {
      expect(
        s.keywords.some((k) => /[一-鿿]/.test(k)),
        `${s.id} zh`,
      ).toBe(true)
      expect(
        s.keywords.some((k) => /^[a-z0-9 ]+$/i.test(k)),
        `${s.id} en`,
      ).toBe(true)
    }
  })
})

describe("permission filter", () => {
  const ids = (u: ReturnType<typeof user>) =>
    visibleSettings(u)
      .map((s) => s.id)
      .sort()

  it("admin sees everything", () => {
    expect(visibleSettings(ADMIN)).toHaveLength(SETTINGS.length)
  })

  it("a normal user sees only shares, transfers, about and docs", () => {
    expect(ids(GENERAL)).toEqual(["about", "docs", "shares", "transfers"])
  })

  it("a delegated user also sees the users page", () => {
    expect(ids(DELEGATED)).toEqual([
      "about",
      "docs",
      "shares",
      "transfers",
      "users",
    ])
  })

  it("a guest sees only about and docs", () => {
    expect(ids(GUEST)).toEqual(["about", "docs"])
  })

  it("defaults to admin only", () => {
    expect(canAccess(undefined, GENERAL)).toBe(false)
    expect(canAccess(undefined, ADMIN)).toBe(true)
  })

  it("groupSettings drops empty groups and keeps order", () => {
    const groups = groupSettings(visibleSettings(GENERAL))
    expect(groups.map((g) => g.id)).toEqual(["storage", "system"])
    expect(groupSettings(SETTINGS).map((g) => g.id)).toEqual(
      SETTING_GROUPS.map((g) => g.id),
    )
  })
})

describe("manageSubPath", () => {
  it("strips the prefix and the hash", () => {
    expect(manageSubPath("/@manage/plugins#cluster")).toBe("/plugins")
    expect(manageSubPath("/@manage/settings/site")).toBe("/settings/site")
    expect(manageSubPath("/@transfers")).toBeUndefined()
    expect(manageSubPath("https://doc.oplist.org")).toBeUndefined()
  })
})
