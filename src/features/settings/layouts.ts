// How a backend settings group is laid out on its page (research 05 §二,
// PLAN_FE_SYSTEM_UX_1127 P3): cards by what the settings act on, each saying
// what it governs, and in each card the rarely changed ones folded under
// "Advanced". Plain data: SettingsCards draws it, the settings search reads it.
// A key of the group that no card names still shows, in a last card.

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
  {
    id: "task-threads",
    title: "settings.layout.task_threads",
    scope: "settings.layout.task_threads_scope",
    keys: THREADS,
    advanced: RARE_THREADS,
    help: scopeOf([...THREADS, ...RARE_THREADS]),
  },
  {
    id: "speed-limits",
    title: "settings.layout.speed_limits",
    scope: "settings.layout.speed_limits_scope",
    keys: CLIENT_LIMITS,
    advanced: SERVER_LIMITS,
    help: scopeOf([...CLIENT_LIMITS, ...SERVER_LIMITS]),
    special: Object.fromEntries(
      [...CLIENT_LIMITS, ...SERVER_LIMITS].map((k) => [k, UNLIMITED]),
    ),
  },
]

/** Every key a layout names, in line or folded. */
export const cardKeys = (cards: readonly SettingsCard[]): string[] =>
  cards.flatMap((c) => [...c.keys, ...(c.advanced ?? [])])

/** The card a key is in, and whether it is folded there. */
export const cardOf = (
  cards: readonly SettingsCard[],
  key: string,
): { card: SettingsCard; folded: boolean } | undefined => {
  for (const card of cards) {
    if (card.keys.includes(key)) return { card, folded: false }
    if (card.advanced?.includes(key)) return { card, folded: true }
  }
  return undefined
}
