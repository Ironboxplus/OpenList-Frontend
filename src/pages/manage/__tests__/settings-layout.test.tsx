import { fireEvent } from "@solidjs/testing-library"
import { beforeEach, describe, expect, it, vi } from "vitest"
vi.mock("~/hooks", async (orig) =>
  (await import("./mocks")).hooksMock(await orig()),
)
vi.mock("~/utils/notify", async () => (await import("./mocks")).notifyMock())

import { Flag, Group, Type } from "~/types"
import CommonSettings from "../settings/Common"
import { lastCall, mockApi, renderPage, settle } from "./harness"
import { resetRouter, router } from "./mocks"

const row = (key: string, type: Type, value: string) => ({
  key,
  value,
  type,
  help: "",
  options: "",
  group: Group.GLOBAL,
  flag: Flag.PRIVATE,
})
// OP internal/bootstrap/data/setting.go:206-247, the Global group
const B = Type.Bool
const N = Type.Number
const S = Type.String
const X = Type.Text
const DEFAULTS = [
  row("hide_files", X, "/\\/README.md/i"),
  row("package_download", B, "true"),
  row("customize_head", X, ""),
  row("customize_body", X, ""),
  row("link_expiration", N, "0"),
  row("sign_all", B, "true"),
  row("privacy_regs", X, ""),
  row("ocr_api", S, "https://ocr"),
  row("filename_char_mapping", X, '{"/": "|"}'),
  row("forward_direct_link_params", B, "false"),
  row("ignore_direct_link_params", S, "sign,openlist_ts,raw"),
  row("webauthn_login_enabled", B, "false"),
  row("max_devices", N, "0"),
  row("device_evict_policy", Type.Select, "deny"),
  row("device_session_ttl", N, "86400"),
  row("share_pwd_max_attempts", N, "5"),
  row("share_pwd_lock_seconds", N, "300"),
  row("share_preview", B, "false"),
  row("share_archive_preview", B, "false"),
  row("share_force_proxy", B, "true"),
  row("share_summary_content", X, "@{{creator}}"),
  row("handle_hook_after_writing", B, "false"),
  row("handle_hook_rate_limit", N, "0"),
  row("ignore_system_files", B, "false"),
  row("seed_site_url", S, ""),
  row("seed_default_matrix", X, "{}"),
  row("seed_format_policies", X, "{}"),
  row("seed_default_format", Type.Select, "oss"),
  row("seed_single_direct_preview", B, "false"),
  row("seed_cas_direct_access", B, "false"),
  row("seed_auto_generate_policy", Type.Select, "off"),
  row("seed_default_trackers", X, ""),
]

let settings = structuredClone(DEFAULTS)

beforeEach(() => {
  resetRouter()
  settings = structuredClone(DEFAULTS)
  mockApi({
    "GET /admin/setting/list": () => structuredClone(settings),
    "POST /admin/setting/default": () => structuredClone(DEFAULTS),
    "POST /admin/setting/save": () => null,
    "GET /public/settings": () => ({}),
  })
})

const card = (id: string) =>
  document.querySelector(`[data-card="${id}"]`) as HTMLElement | null
const field = (key: string) =>
  document.querySelector(`[data-field="${key}"]`) as HTMLElement | null
const trigger = (id: string) =>
  document.querySelector(`[data-testid="advanced-${id}"]`) as HTMLElement

describe("a long settings page in cards", () => {
  it("groups Global by what the settings act on, each card saying what it governs", async () => {
    renderPage(() => <CommonSettings group={Group.GLOBAL} />)
    await settle()
    const cards = [...document.querySelectorAll("[data-card]")].map(
      (c) => (c as HTMLElement).dataset.card,
    )
    expect(cards).toEqual(
      expect.arrayContaining(["files", "links", "sign-in", "sharing"]),
    )
    for (const id of cards)
      expect(
        card(id!)!.querySelector("[data-scope]")?.textContent?.trim(),
        id,
      ).toBeTruthy()
    // every key found a card: nothing left over
    expect(card("rest")).toBeNull()
    expect(field("sign_all")!.closest("[data-card]")).toBe(card("links"))
  })

  it("folds each card's rare settings, and marks the ones not at their default", async () => {
    settings = settings.map((s) =>
      s.key === "share_pwd_lock_seconds" ? { ...s, value: "60" } : s,
    )
    renderPage(() => <CommonSettings group={Group.GLOBAL} />)
    await settle()
    expect(field("share_preview")!.closest("[hidden]")).toBeNull()
    expect(trigger("links").getAttribute("aria-expanded")).toBe("false")
    expect(field("ignore_direct_link_params")!.closest("[hidden]")).toBeTruthy()
    expect(trigger("sharing").getAttribute("aria-expanded")).toBe("true")
    expect(
      trigger("sharing").querySelector("[data-testid=changed-mark]")
        ?.textContent,
    ).toMatch(/1/)
    fireEvent.click(trigger("links"))
    await settle()
    expect(trigger("links").getAttribute("aria-expanded")).toBe("true")
  })

  it("leaves the seed settings to their own page, but for the trackers", async () => {
    renderPage(() => <CommonSettings group={Group.GLOBAL} />)
    await settle()
    expect(field("seed_site_url")).toBeNull()
    expect(field("seed_default_trackers")).toBeTruthy()
    const link = card("seeds")!.querySelector(
      "a[data-elsewhere]",
    ) as HTMLAnchorElement
    expect(link.getAttribute("href")).toMatch(/\/@manage\/settings\/seed$/)
    fireEvent.click(link)
    expect(router.to).toHaveBeenCalledWith("/@manage/settings/seed")
  })

  it("opens the folded group of a setting a search led to", async () => {
    router.searchParams = { focus: "device_session_ttl" }
    renderPage(() => <CommonSettings group={Group.GLOBAL} />)
    await settle()
    expect(trigger("sign-in").getAttribute("aria-expanded")).toBe("true")
    expect(field("device_session_ttl")!.hasAttribute("data-focused")).toBe(true)
  })

  it("still saves the whole group", async () => {
    renderPage(() => <CommonSettings group={Group.GLOBAL} />)
    await settle()
    fireEvent.click(
      document.getElementById("sign_all-input") ??
        document.getElementById("sign_all")!,
    )
    const save = [...document.querySelectorAll("button")].find(
      (b) => b.textContent?.trim() === "Save",
    )!
    fireEvent.click(save)
    await settle()
    const body = lastCall("POST", "/admin/setting/save")!.body as {
      key: string
      value: string
    }[]
    expect(body).toHaveLength(DEFAULTS.length)
    expect(body.find((s) => s.key === "sign_all")?.value).toBe("false")
  })
})
