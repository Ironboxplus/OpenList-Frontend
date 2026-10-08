import { describe, expect, it } from "vitest"
import { entryFor, settingsCrumbs } from "../crumbs"

describe("settingsCrumbs", () => {
  it("is just Settings on the home page", () => {
    expect(settingsCrumbs("/@manage")).toEqual([{ key: "shell.nav.settings" }])
    expect(settingsCrumbs("/@manage/")).toEqual([{ key: "shell.nav.settings" }])
  })

  it("is Settings > group > page, with Settings linking home", () => {
    expect(settingsCrumbs("/@manage/settings/traffic")).toEqual([
      { key: "shell.nav.settings", href: "/@manage" },
      { key: "settings.groups.storage" },
      { key: "settings.items.traffic.title" },
    ])
  })

  it("links the page crumb on deeper pages (add / edit)", () => {
    const c = settingsCrumbs("/@manage/storages/edit/3")
    expect(c.at(-1)).toEqual({
      key: "settings.items.storages.title",
      href: "/@manage/storages",
    })
    expect(c[1].key).toBe("settings.groups.storage")
  })

  it("tells plugins from the cluster entry by the hash", () => {
    expect(entryFor("/@manage/plugins", "")?.id).toBe("plugins")
    expect(entryFor("/@manage/plugins", "#cluster")?.id).toBe("cluster")
    expect(settingsCrumbs("/@manage/plugins", "#cluster")[1].key).toBe(
      "settings.groups.extensions",
    )
  })

  it("knows the profile page", () => {
    expect(settingsCrumbs("/@manage/profile")).toEqual([
      { key: "shell.nav.settings", href: "/@manage" },
      { key: "shell.nav.profile" },
    ])
  })

  it("falls back to a linked Settings for unknown pages", () => {
    expect(settingsCrumbs("/@manage/zzz")).toEqual([
      { key: "shell.nav.settings", href: "/@manage" },
    ])
  })

  it("does not confuse a prefix with a path segment", () => {
    expect(entryFor("/@manage/storagesx")).toBeUndefined()
  })
})
