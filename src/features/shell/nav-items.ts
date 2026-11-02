import { getSettingBool } from "~/store"
import { User, UserMethods } from "~/types"

export type NavId =
  "dashboard" | "files" | "media" | "transfers" | "plugins" | "settings"
export type NavIcon = NavId
export type NavArea = "main" | "secondary"

export interface NavItem {
  id: NavId
  /** i18n key for the visible label. */
  labelKey: string
  /** Base-relative route. */
  path: string
  icon: NavIcon
  area: NavArea
  /** Whether the item goes into the phone tab bar (at most four). */
  phone: boolean
  visible: (user: User, env: NavEnv) => boolean
}

/** What besides the user decides visibility: PUBLIC settings. */
export interface NavEnv {
  mediaEnabled: boolean
}

export const navEnv = (): NavEnv => ({
  mediaEnabled: getSettingBool("media_enabled"),
})

const signedIn = (u: User) => !UserMethods.is_guest(u)

/**
 * Dashboard, Files, Media, Transfers and Plugins are the main navigation;
 * Files stays on `/`, Transfers is the single user-facing task concept.
 * Settings is a secondary entry. A guest only gets Files, as before; Media also
 * needs the media switch (a PUBLIC setting). Visibility of Settings follows the
 * existing manage entry (see pages/home/header/user-menu.ts).
 */
export const NAV_ITEMS: readonly NavItem[] = [
  {
    id: "dashboard",
    labelKey: "shell.nav.dashboard",
    path: "/@dashboard",
    icon: "dashboard",
    area: "main",
    phone: true,
    visible: signedIn,
  },
  {
    id: "files",
    labelKey: "shell.nav.files",
    path: "/",
    icon: "files",
    area: "main",
    phone: true,
    visible: () => true,
  },
  {
    id: "media",
    labelKey: "shell.nav.media",
    path: "/@media",
    icon: "media",
    area: "main",
    phone: true,
    visible: (u, env) => signedIn(u) && env.mediaEnabled,
  },
  {
    id: "transfers",
    labelKey: "shell.nav.transfers",
    path: "/@transfers",
    icon: "transfers",
    area: "main",
    phone: true,
    visible: signedIn,
  },
  {
    id: "plugins",
    labelKey: "shell.nav.plugins",
    path: "/@plugins",
    icon: "plugins",
    area: "main",
    phone: false,
    visible: signedIn,
  },
  {
    id: "settings",
    labelKey: "shell.nav.settings",
    path: "/@manage",
    icon: "settings",
    area: "secondary",
    phone: false,
    visible: signedIn,
  },
]

export const navItemsFor = (
  user: User,
  area?: NavArea,
  env: NavEnv = navEnv(),
): NavItem[] =>
  NAV_ITEMS.filter((i) => (!area || i.area === area) && i.visible(user, env))

/** The items of the phone tab bar; the rest live in the "me" sheet. */
export const phoneTabItems = (user: User, env: NavEnv = navEnv()): NavItem[] =>
  navItemsFor(user, undefined, env).filter((i) => i.phone)

const isUnder = (pathname: string, prefix: string) =>
  pathname === prefix || pathname.startsWith(prefix + "/")

/** Which nav item the (base-trimmed) pathname belongs to. */
export const activeNavId = (pathname: string): NavId | undefined => {
  if (isUnder(pathname, "/@dashboard")) return "dashboard"
  if (isUnder(pathname, "/@media")) return "media"
  if (isUnder(pathname, "/@transfers")) return "transfers"
  if (isUnder(pathname, "/@plugins")) return "plugins"
  if (isUnder(pathname, "/@manage")) return "settings"
  if (pathname.startsWith("/@")) return undefined
  return "files"
}

/**
 * The code chunk behind each section. The router's `lazy()` pages are made from
 * these, and the same loaders warm the chunks up ahead of the click, so one
 * table says what "going to a section" costs.
 */
export const SECTION_LOADERS: Record<NavId, () => Promise<{ default: any }>> = {
  dashboard: () => import("~/features/dashboard/DashboardPage"),
  files: () => import("~/pages/home/Layout"),
  media: () => import("~/pages/media/MediaSection"),
  transfers: () => import("~/features/transfers/TransfersPage"),
  plugins: () => import("~/features/plugins/PluginsPage"),
  settings: () => import("~/pages/manage"),
}

/** Start loading a section's chunk; failures are left to the real navigation. */
export const preloadSection = (id: NavId): void => {
  void SECTION_LOADERS[id]().catch(() => {})
}

/** Warm every section's chunk when the browser is idle (after sign-in). */
export const preloadAllSections = (
  ids: readonly NavId[] = Object.keys(SECTION_LOADERS) as NavId[],
): (() => void) => {
  const run = () => ids.forEach(preloadSection)
  if (typeof requestIdleCallback === "function") {
    const h = requestIdleCallback(run)
    return () => cancelIdleCallback(h)
  }
  const h = setTimeout(run, 200)
  return () => clearTimeout(h)
}

/** The transfer badge hangs on the Transfers item (tab bar, side nav). */
export const badgeTarget = (id: NavId): boolean => id === "transfers"

type KV = Pick<Storage, "getItem" | "setItem">
export const COLLAPSED_KEY = "shell-nav-collapsed"

export const readCollapsed = (s: KV): boolean => {
  try {
    return s.getItem(COLLAPSED_KEY) === "1"
  } catch {
    return false
  }
}

export const writeCollapsed = (s: KV, v: boolean) => {
  try {
    s.setItem(COLLAPSED_KEY, v ? "1" : "0")
  } catch {
    // storage unavailable: the choice just doesn't persist
  }
}
