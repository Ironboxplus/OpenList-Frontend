// Breadcrumb for pages under /@manage: Settings > group > page.
import {
  routePath,
  settingsForBackend,
  type SettingContribution,
} from "./registry"

export interface Crumb {
  /** i18n key for the label. */
  key: string
  /** Absent on the current page and on the group (it has no page of its own). */
  href?: string
}

export const SETTINGS_HOME = "/@manage"
const SETTINGS_KEY = "shell.nav.settings"
const PROFILE_PATH = "/@manage/profile"

const hashOf = (route: string) =>
  route.includes("#") ? "#" + route.split("#")[1] : ""

/** The registry entry a /@manage address belongs to (deeper add/edit pages included). */
export const entryFor = (
  pathname: string,
  hash = "",
): SettingContribution | undefined => {
  let best: SettingContribution | undefined
  let bestScore = -1
  for (const e of settingsForBackend()) {
    if (e.external) continue
    const base = routePath(e.route)
    if (!base.startsWith("/@manage/")) continue
    if (pathname !== base && !pathname.startsWith(base + "/")) continue
    const h = hashOf(e.route)
    if (h && h !== hash) continue
    // Longest path wins; at equal length an entry whose hash matches wins.
    const score = base.length * 2 + (h ? 1 : 0)
    if (score > bestScore) {
      best = e
      bestScore = score
    }
  }
  return best
}

export const settingsCrumbs = (pathname: string, hash = ""): Crumb[] => {
  const p = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname
  if (p === SETTINGS_HOME) return [{ key: SETTINGS_KEY }]
  const home: Crumb = { key: SETTINGS_KEY, href: SETTINGS_HOME }
  if (p === PROFILE_PATH) return [home, { key: "shell.nav.profile" }]
  const entry = entryFor(p, hash)
  if (!entry) return [home]
  const deeper = p !== routePath(entry.route)
  return [
    home,
    { key: `settings.groups.${entry.group}` },
    { key: entry.title, href: deeper ? entry.route : undefined },
  ]
}
