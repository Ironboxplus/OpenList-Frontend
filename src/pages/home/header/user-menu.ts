import { User, UserMethods } from "~/types"

export type UserMenuEntryId = "login" | "manage" | "logout"

export interface UserMenuEntry {
  id: UserMenuEntryId
  /** i18n key for the visible label. */
  labelKey: string
  /** "link" navigates via href; "action" runs a handler (e.g. logout). */
  kind: "link" | "action"
  /** Present for link entries. */
  href?: string
  /** Render with a destructive/danger style. */
  danger?: boolean
}

const LOGIN: UserMenuEntry = {
  id: "login",
  labelKey: "login.login",
  kind: "link",
  href: "/@login",
}

const MANAGE: UserMenuEntry = {
  id: "manage",
  labelKey: "home.footer.manage",
  kind: "link",
  href: "/@manage",
}

const LOGOUT: UserMenuEntry = {
  id: "logout",
  labelKey: "manage.logout",
  kind: "action",
  danger: true,
}

/**
 * Decide which entries the header user-menu should show for the current user.
 * Guests can only log in; authenticated users get the manage area and logout.
 * Pure and dependency-free so it can be unit-tested in isolation.
 */
export const userMenuEntries = (user: User): UserMenuEntry[] => {
  if (UserMethods.is_guest(user)) {
    return [LOGIN]
  }
  return [MANAGE, LOGOUT]
}
