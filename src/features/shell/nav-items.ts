import { User, UserMethods } from "~/types"

export type NavId = "files" | "transfers" | "settings"
export type NavIcon = "files" | "transfers" | "settings"
export type NavArea = "main" | "secondary"

export interface NavItem {
  id: NavId
  /** i18n key for the visible label. */
  labelKey: string
  /** Base-relative route. */
  path: string
  icon: NavIcon
  area: NavArea
  visible: (user: User) => boolean
}

/**
 * Files stays on `/`; Transfers is the single user-facing task concept.
 * Settings is a secondary entry. Visibility follows the existing manage entry
 * (see pages/home/header/user-menu.ts): everyone but a guest.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  {
    id: "files",
    labelKey: "shell.nav.files",
    path: "/",
    icon: "files",
    area: "main",
    visible: () => true,
  },
  {
    id: "transfers",
    labelKey: "shell.nav.transfers",
    path: "/@transfers",
    icon: "transfers",
    area: "main",
    visible: (u) => !UserMethods.is_guest(u),
  },
  {
    id: "settings",
    labelKey: "shell.nav.settings",
    path: "/@manage",
    icon: "settings",
    area: "secondary",
    visible: (u) => !UserMethods.is_guest(u),
  },
]

export const navItemsFor = (user: User, area?: NavArea): NavItem[] =>
  NAV_ITEMS.filter((i) => (!area || i.area === area) && i.visible(user))

const isUnder = (pathname: string, prefix: string) =>
  pathname === prefix || pathname.startsWith(prefix + "/")

/** Which nav item the (base-trimmed) pathname belongs to. */
export const activeNavId = (pathname: string): NavId | undefined => {
  if (isUnder(pathname, "/@transfers")) return "transfers"
  if (isUnder(pathname, "/@manage")) return "settings"
  if (pathname.startsWith("/@")) return undefined
  return "files"
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
