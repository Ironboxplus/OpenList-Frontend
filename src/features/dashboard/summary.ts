// What the dashboard cards show, derived from data the stores already hold.
import type { UnifiedTask } from "~/platform/contracts/task"
import { sortFavorites, type Favorite } from "~/plugins/builtin/favorites/data"
import { sectionOf } from "../transfers/adapter"
import type { ErrorRecord } from "../notifications/store"

export const RECENT_ERRORS = 3
export const TOP_FAVORITES = 8

export interface TransferSummary {
  active: number
  failed: number
  /** Running tasks whose progress stopped moving (see transfers/stall.ts). */
  stale: number
}

export const summarizeTransfers = (
  tasks: readonly UnifiedTask[],
): TransferSummary => ({
  active: tasks.filter((t) => sectionOf(t.state) === "active").length,
  failed: tasks.filter((t) => t.state === "failed").length,
  stale: tasks.filter((t) => t.stale).length,
})

/** The error center keeps newest first already. */
export const recentErrors = (
  records: readonly ErrorRecord[],
  n = RECENT_ERRORS,
): ErrorRecord[] => records.slice(0, n)

export const topFavorites = (favs: Favorite[], n = TOP_FAVORITES): Favorite[] =>
  sortFavorites(favs).slice(0, n)

/**
 * The plugin slots the page renders, in order. The old `manage-dashboard`
 * slot stays for external plugins written against it, but its contributions
 * (like the built-in storage charts) call admin APIs, so only admins get it.
 */
export const dashboardSlots = (isAdmin: boolean): string[] =>
  isAdmin ? ["dashboard", "manage-dashboard"] : ["dashboard"]
