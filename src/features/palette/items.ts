// What the command palette can find and run. Pure: the caller supplies the
// translator and the effects, so permission rules are unit-testable.
import type { IconTypes } from "solid-icons"
import {
  TbArrowsUpDown,
  TbFolder,
  TbLanguage,
  TbListDetails,
  TbMoon,
  TbPlus,
  TbSettings,
} from "solid-icons/tb"
import { NAV_ITEMS, type NavId } from "../shell/nav-items"
import { openSetting } from "../settings/open"
import { visibleSettings } from "../settings/registry"
import { UserMethods, type User } from "~/types"
import type { Rankable } from "./rank"

export type PaletteGroup = "nav" | "setting" | "action"

export interface PaletteItem extends Rankable {
  /** Stable across sessions: the recent list stores it. */
  id: string
  group: PaletteGroup
  icon: IconTypes
  /** Secondary line, e.g. the group a setting lives in. */
  hint?: string
  run: () => void
}

export interface PaletteContext {
  user: Pick<User, "role" | "permission">
  t: (key: string) => string
  /** Whether the backend serves the sync API (store.syncAvailable()). */
  syncAvailable: boolean
  go: (path: string) => void
  newSync: () => void
  openTaskCenter: () => void
  toggleTheme: () => void
  toggleLanguage: () => void
}

const NAV_KEYWORDS: Record<NavId, string[]> = {
  files: ["files", "browse", "home", "文件", "首页", "浏览"],
  transfers: ["transfers", "tasks", "传输", "任务"],
  settings: ["settings", "manage", "admin", "设置", "管理", "后台"],
}

const NAV_ICONS: Record<NavId, IconTypes> = {
  files: TbFolder,
  transfers: TbArrowsUpDown,
  settings: TbSettings,
}

export const buildPaletteItems = (ctx: PaletteContext): PaletteItem[] => {
  const { t, user } = ctx
  const items: PaletteItem[] = []

  const navPaths = new Set<string>()
  for (const nav of NAV_ITEMS) {
    if (!nav.visible(user as User)) continue
    navPaths.add(nav.path)
    items.push({
      id: `nav:${nav.id}`,
      group: "nav",
      title: t(nav.labelKey),
      keywords: NAV_KEYWORDS[nav.id],
      icon: NAV_ICONS[nav.id],
      run: () => ctx.go(nav.path),
    })
  }

  for (const entry of visibleSettings(user)) {
    // The registry also lists Transfers; the navigation entry already covers it.
    if (navPaths.has(entry.route)) continue
    items.push({
      id: `setting:${entry.id}`,
      group: "setting",
      title: t(entry.title),
      keywords: [...entry.keywords, t(entry.description)],
      icon: entry.icon,
      hint: t(`settings.groups.${entry.group}`),
      run: () => openSetting(entry, ctx.go),
    })
  }

  const signedIn = !UserMethods.is_guest(user as User)
  if (UserMethods.is_admin(user as User) && ctx.syncAvailable) {
    items.push({
      id: "action:new-sync",
      group: "action",
      title: t("palette.actions.new_sync"),
      keywords: [
        "同步",
        "同步作业",
        "新建同步作业",
        "新建",
        "sync",
        "new sync job",
        "create sync",
        "rclone",
        "mirror",
      ],
      icon: TbPlus,
      run: ctx.newSync,
    })
  }
  if (signedIn) {
    items.push({
      id: "action:task-center",
      group: "action",
      title: t("palette.actions.task_center"),
      keywords: [
        "任务中心",
        "任务",
        "task center",
        "tasks",
        "progress",
        "进度",
      ],
      icon: TbListDetails,
      run: ctx.openTaskCenter,
    })
  }
  items.push(
    {
      id: "action:toggle-theme",
      group: "action",
      title: t("palette.actions.toggle_theme"),
      keywords: [
        "深色",
        "浅色",
        "夜间",
        "主题",
        "dark",
        "light",
        "theme",
        "night",
      ],
      icon: TbMoon,
      run: ctx.toggleTheme,
    },
    {
      id: "action:toggle-language",
      group: "action",
      title: t("palette.actions.toggle_language"),
      keywords: ["语言", "中文", "english", "language", "lang", "i18n"],
      icon: TbLanguage,
      run: ctx.toggleLanguage,
    },
  )
  return items
}

/** Recent first (those still available), then navigation and actions. */
export const emptyQueryList = (
  items: readonly PaletteItem[],
  recentIds: readonly string[],
): { item: PaletteItem; recent: boolean }[] => {
  const byId = new Map(items.map((i) => [i.id, i]))
  const recent = recentIds
    .map((id) => byId.get(id))
    .filter((i): i is PaletteItem => i !== undefined)
  const seen = new Set(recent.map((i) => i.id))
  const rest = items.filter((i) => i.group !== "setting" && !seen.has(i.id))
  return [
    ...recent.map((item) => ({ item, recent: true })),
    ...rest.map((item) => ({ item, recent: false })),
  ]
}
