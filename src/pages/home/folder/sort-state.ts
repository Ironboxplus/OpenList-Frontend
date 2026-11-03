import { createSignal } from "solid-js"
import { getSetting } from "~/store/settings"

export interface SortState {
  orderBy: string
  reverse: boolean
}

const SORT_KEY_PREFIX = "dir_sort_"

// What the user sorted by in this session, per directory. It is all that is
// kept when the site does not remember sorting (frontend_remember_sort off).
const sessionSort = new Map<string, SortState>()

// Absent (an older backend) means remember: that is what the list always did.
const remembering = () => getSetting("frontend_remember_sort") !== "false"

// Bumped on every save, so anything that reads loadSortState in a reactive
// scope (the list header, the toolbar sort menu) follows the other's changes.
const [saves, setSaves] = createSignal(0)

export function saveSortState(dir: string, state: SortState) {
  sessionSort.set(dir, state)
  setSaves((n) => n + 1)
  if (!remembering()) return
  try {
    localStorage.setItem(`${SORT_KEY_PREFIX}${dir}`, JSON.stringify(state))
  } catch (err) {
    console.warn("failed to save sort config:", err)
  }
}

export function loadSortState(dir: string): SortState | null {
  saves()
  const session = sessionSort.get(dir)
  if (session) return session
  // Not remembering: the backend's order stands until the user sorts.
  if (!remembering()) return null
  try {
    const item = localStorage.getItem(`${SORT_KEY_PREFIX}${dir}`)
    if (!item) return null
    return JSON.parse(item) as SortState
  } catch (err) {
    console.warn("failed to read sort config:", err)
    return null
  }
}

/** Back to the storage's own order: forget the choice for this directory. */
export function clearSortState(dir: string) {
  sessionSort.delete(dir)
  setSaves((n) => n + 1)
  try {
    localStorage.removeItem(`${SORT_KEY_PREFIX}${dir}`)
  } catch (err) {
    console.warn("failed to clear sort config:", err)
  }
}
