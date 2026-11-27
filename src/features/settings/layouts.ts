// How a backend settings group is laid out on its page (research 05 §二,
// PLAN_FE_SYSTEM_UX_1127 P3): cards by what the settings act on, each saying
// what it governs, and in each card the rarely changed ones folded under
// "Advanced". Plain data: SettingsCards draws it, the settings search reads it.
// A key of the group that no card names still shows, in a last card.
import { Group } from "~/types"

/** A special value of a number written as words ("Unlimited" for -1). */
export interface SpecialValue {
  value: string
  labelKey: string
}

export interface SettingsCard {
  /** data-card, the Advanced group's test id and the DOM id `card-<id>`. */
  id: string
  /** i18n keys. */
  title: string
  scope: string
  /** Shown in line, in this order. */
  keys: string[]
  /** Rarely changed: folded under Advanced (in line below ADVANCED_MIN_ITEMS). */
  advanced?: string[]
  /** i18n key of what a setting governs, where the backend has no help text. */
  help?: Record<string, string>
  special?: Record<string, SpecialValue>
  /**
   * Keys of the group that have a page of their own (registry entry `entry`):
   * not drawn here, the card leads there instead.
   */
  elsewhere?: { entry: string; keys: string[] }
}

const card = (
  id: string,
  keys: string[],
  extra: Partial<SettingsCard> = {},
): SettingsCard => {
  const name = id.replace(/-/g, "_")
  return {
    id,
    title: `settings.layout.${name}`,
    scope: `settings.layout.${name}_scope`,
    keys,
    ...extra,
  }
}

const scopeOf = (keys: string[]) =>
  Object.fromEntries(keys.map((k) => [k, `settings.layout.${k}_scope`]))

const THREADS = [
  "copy_task_threads_num",
  "upload_task_threads_num",
  "offline_download_task_threads_num",
]
const RARE_THREADS = [
  "move_task_threads_num",
  "offline_download_transfer_task_threads_num",
  "decompress_download_task_threads_num",
  "decompress_upload_task_threads_num",
]
const CLIENT_LIMITS = ["max_client_download_speed", "max_client_upload_speed"]
const SERVER_LIMITS = ["max_server_download_speed", "max_server_upload_speed"]
// any negative value is no limit (OP internal/bootstrap/stream_limit.go:33-38)
const UNLIMITED: SpecialValue = { value: "-1", labelKey: "global.unlimited" }

/** The Traffic group (OP internal/bootstrap/data/setting.go:309-320). */
export const TRANSFER_CARDS: SettingsCard[] = [
  card("task-threads", THREADS, {
    advanced: RARE_THREADS,
    help: scopeOf([...THREADS, ...RARE_THREADS]),
  }),
  card("speed-limits", CLIENT_LIMITS, {
    advanced: SERVER_LIMITS,
    help: scopeOf([...CLIENT_LIMITS, ...SERVER_LIMITS]),
    special: Object.fromEntries(
      [...CLIENT_LIMITS, ...SERVER_LIMITS].map((k) => [k, UNLIMITED]),
    ),
  }),
]

/** The Site group (setting.go:144-154). */
const SITE_CARDS: SettingsCard[] = [
  card("site", ["site_title", "announcement", "version"]),
  card("lists", [
    "pagination_type",
    "default_page_size",
    "frontend_remember_sort",
  ]),
  card("visibility", ["allow_indexed", "allow_mounted", "robots_txt"]),
]

/** The Style group (setting.go:156-165). */
const STYLE_CARDS: SettingsCard[] = [
  card("brand", ["logo", "favicon", "main_color"], {
    advanced: ["home_icon", "share_icon"],
  }),
  card("page-layout", ["home_container", "settings_layout"]),
  card("storage-details", [
    "hide_storage_details",
    "show_disk_usage_in_plain_text",
    "hide_storage_details_in_manage_page",
  ]),
]

/** The Preview group (setting.go:167-204). */
const PREVIEW_CARDS: SettingsCard[] = [
  card("file-types", [
    "video_types",
    "audio_types",
    "image_types",
    "text_types",
  ]),
  card("playback", ["video_autoplay", "audio_autoplay", "audio_cover"], {
    advanced: ["proxy_types", "proxy_ignore_headers"],
  }),
  card("opening", [
    "preview_download_by_default",
    "preview_archives_by_default",
    "share_preview_download_by_default",
    "share_preview_archives_by_default",
    "non_efs_zip_encoding",
  ]),
  card("viewers", ["iframe_previews", "external_previews", "preview_settings"]),
  card("readme", ["readme_autorender", "filter_readme_scripts"]),
]

/** The Global group (setting.go:206-247). */
const GLOBAL_CARDS: SettingsCard[] = [
  card("files", ["hide_files", "package_download"], {
    advanced: ["ignore_system_files", "filename_char_mapping"],
  }),
  card("links", ["sign_all", "link_expiration"], {
    advanced: ["forward_direct_link_params", "ignore_direct_link_params"],
  }),
  card("sign-in", ["max_devices", "webauthn_login_enabled"], {
    advanced: ["device_evict_policy", "device_session_ttl"],
  }),
  card(
    "sharing",
    ["share_preview", "share_archive_preview", "share_force_proxy"],
    {
      advanced: [
        "share_pwd_max_attempts",
        "share_pwd_lock_seconds",
        "share_summary_content",
      ],
    },
  ),
  card("page-code", ["customize_head", "customize_body"]),
  card("global-other", [], {
    advanced: [
      "privacy_regs",
      "ocr_api",
      "handle_hook_after_writing",
      "handle_hook_rate_limit",
    ],
  }),
  // the seed page edits these (pages/manage/settings/Seed.tsx), not the trackers
  card("seeds", ["seed_default_trackers"], {
    elsewhere: {
      entry: "seed",
      keys: [
        "seed_site_url",
        "seed_default_matrix",
        "seed_format_policies",
        "seed_default_format",
        "seed_auto_generate_policy",
        "seed_single_direct_preview",
        "seed_cas_direct_access",
      ],
    },
  }),
]

/** The groups that are laid out in cards; the others are one card. */
export const LAYOUTS: Partial<Record<Group, SettingsCard[]>> = {
  [Group.SITE]: SITE_CARDS,
  [Group.STYLE]: STYLE_CARDS,
  [Group.PREVIEW]: PREVIEW_CARDS,
  [Group.GLOBAL]: GLOBAL_CARDS,
  [Group.TRAFFIC]: TRANSFER_CARDS,
}

/** The page (registry entry id) of each laid-out group, for the search. */
export const LAYOUT_PAGES: Record<string, SettingsCard[]> = {
  site: SITE_CARDS,
  style: STYLE_CARDS,
  preview: PREVIEW_CARDS,
  global: GLOBAL_CARDS,
  transfers: TRANSFER_CARDS,
}

/** Every key a layout draws, in line or folded. */
export const cardKeys = (cards: readonly SettingsCard[]): string[] =>
  cards.flatMap((c) => [...c.keys, ...(c.advanced ?? [])])
