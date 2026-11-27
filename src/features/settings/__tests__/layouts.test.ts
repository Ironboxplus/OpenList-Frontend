import * as i18n from "@solid-primitives/i18n"
import { describe, expect, it } from "vitest"
import { ADVANCED_MIN_ITEMS } from "~/components/ui/advanced-group"
import { dict } from "~/lang/en/entry"
import { Group } from "~/types"
import { SETTINGS } from "../registry"
import { cardKeys, LAYOUTS, TRANSFER_CARDS } from "../layouts"

const flat = i18n.flatten(dict) as unknown as Record<string, string>

// The keys of each group as the backend makes them (OP
// internal/bootstrap/data/setting.go:144-247, :309-320, :458-460).
const BACKEND: Partial<Record<Group, string[]>> = {
  [Group.SITE]: [
    "version",
    "site_title",
    "frontend_remember_sort",
    "announcement",
    "pagination_type",
    "default_page_size",
    "allow_indexed",
    "allow_mounted",
    "robots_txt",
  ],
  [Group.STYLE]: [
    "logo",
    "favicon",
    "main_color",
    "home_icon",
    "share_icon",
    "home_container",
    "settings_layout",
    "hide_storage_details",
    "hide_storage_details_in_manage_page",
    "show_disk_usage_in_plain_text",
  ],
  [Group.PREVIEW]: [
    "text_types",
    "audio_types",
    "video_types",
    "image_types",
    "proxy_types",
    "proxy_ignore_headers",
    "external_previews",
    "iframe_previews",
    "preview_settings",
    "audio_cover",
    "audio_autoplay",
    "video_autoplay",
    "preview_download_by_default",
    "preview_archives_by_default",
    "share_preview_download_by_default",
    "share_preview_archives_by_default",
    "readme_autorender",
    "filter_readme_scripts",
    "non_efs_zip_encoding",
  ],
  [Group.GLOBAL]: [
    "hide_files",
    "package_download",
    "customize_head",
    "customize_body",
    "link_expiration",
    "sign_all",
    "privacy_regs",
    "ocr_api",
    "filename_char_mapping",
    "forward_direct_link_params",
    "ignore_direct_link_params",
    "webauthn_login_enabled",
    "max_devices",
    "device_evict_policy",
    "device_session_ttl",
    "share_pwd_max_attempts",
    "share_pwd_lock_seconds",
    "share_preview",
    "share_archive_preview",
    "share_force_proxy",
    "share_summary_content",
    "handle_hook_after_writing",
    "handle_hook_rate_limit",
    "ignore_system_files",
    "seed_site_url",
    "seed_default_matrix",
    "seed_format_policies",
    "seed_default_format",
    "seed_single_direct_preview",
    "seed_cas_direct_access",
    "seed_auto_generate_policy",
    "seed_default_trackers",
  ],
  [Group.TRAFFIC]: [
    "offline_download_task_threads_num",
    "offline_download_transfer_task_threads_num",
    "upload_task_threads_num",
    "copy_task_threads_num",
    "move_task_threads_num",
    "decompress_download_task_threads_num",
    "decompress_upload_task_threads_num",
    "max_client_download_speed",
    "max_client_upload_speed",
    "max_server_download_speed",
    "max_server_upload_speed",
    // :458-460, below the others (the CI audit of 5fa54008 found them in a
    // leftover card on Transfer settings)
    "multipart_enabled",
    "multipart_chunk_size",
  ],
}

describe("settings layouts", () => {
  it("lays out the long pages: Site, Style, Preview, Global and Transfer", () => {
    for (const g of [Group.SITE, Group.STYLE, Group.PREVIEW, Group.GLOBAL])
      expect(LAYOUTS[g], Group[g]).toBeTruthy()
    expect(LAYOUTS[Group.TRAFFIC]).toBe(TRANSFER_CARDS)
  })

  it("places every key of the group once, in line, folded or on another page", () => {
    for (const [g, keys] of Object.entries(BACKEND)) {
      const cards = LAYOUTS[Number(g) as Group]!
      const placed = [
        ...cardKeys(cards),
        ...cards.flatMap((c) => c.elsewhere?.keys ?? []),
      ]
      expect([...placed].sort(), Group[Number(g)]).toEqual([...keys].sort())
    }
  })

  it("says what every card governs, in English", () => {
    for (const cards of Object.values(LAYOUTS))
      for (const c of cards!) {
        expect(flat[c.title], c.title).toBeTruthy()
        expect(flat[c.scope], c.scope).toBeTruthy()
        for (const help of Object.values(c.help ?? {}))
          expect(flat[help], help).toBeTruthy()
      }
  })

  it("folds only where there are at least two rare items", () => {
    for (const cards of Object.values(LAYOUTS))
      for (const c of cards!)
        if (c.advanced?.length)
          expect(c.advanced.length, c.id).toBeGreaterThanOrEqual(
            ADVANCED_MIN_ITEMS,
          )
  })

  it("sends what lives on another page there", () => {
    const seeds = LAYOUTS[Group.GLOBAL]!.find((c) => c.elsewhere)!
    expect(SETTINGS.some((s) => s.id === seeds.elsewhere!.entry)).toBe(true)
    expect(seeds.elsewhere!.keys).toContain("seed_site_url")
  })
})
