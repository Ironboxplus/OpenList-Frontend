// The error center's data: the last errors worth showing the user again, kept
// per user in localStorage. Everything gets in through `record`; it alone
// decides what is an error worth keeping.
import {
  batch,
  createComputed,
  createMemo,
  createRoot,
  createSignal,
} from "solid-js"
import type { ErrorCategory } from "~/platform/contracts/task"

export interface ErrorRecord {
  id: string
  /** ms since epoch of the latest occurrence */
  at: number
  category: ErrorCategory
  /** Where it came from: a request path, "storage.loading", "task.copy", ... */
  source: string
  message: string
  detail?: string
  /** Where the user can look at it (an in-app path). */
  href?: string
  taskId?: string
  read: boolean
  /** How many times the same source + message happened within DEDUPE_MS. */
  count: number
}

/** What a source hands in; the store adds id, time, read flag and count. */
export interface ErrorInput {
  category: ErrorCategory
  source: string
  message?: string
  detail?: string
  href?: string
  taskId?: string
}

export const MAX_RECORDS = 200
/** The same source + message inside this window is one record. */
export const DEDUPE_MS = 10_000

/** Handled elsewhere: the login flow owns 401, and a canceled request is not a failure. */
const IGNORED: readonly ErrorCategory[] = ["auth", "canceled"]

export interface ErrorStoreDeps {
  storage: Pick<Storage, "getItem" | "setItem">
  /** Name of the signed-in user; records are kept apart per name. */
  user: () => string
  now: () => number
}

const keyOf = (user: string) => `error-center:${user || "guest"}`

const read = (s: ErrorStoreDeps["storage"], user: string): ErrorRecord[] => {
  try {
    const v = JSON.parse(s.getItem(keyOf(user)) ?? "[]")
    return Array.isArray(v) ? v.slice(0, MAX_RECORDS) : []
  } catch {
    return []
  }
}

export const createErrorStore = (deps: ErrorStoreDeps) =>
  createRoot((dispose) => {
    const [list, setList] = createSignal<ErrorRecord[]>([])
    let seq = 0

    // Switching users swaps the whole list; nothing of the other user is kept.
    // The memo compares names, so a refetched profile of the same user does not reload.
    const user = createMemo(deps.user)
    createComputed(() => setList(read(deps.storage, user())))

    const commit = (next: ErrorRecord[]) => {
      setList(next)
      try {
        deps.storage.setItem(keyOf(user()), JSON.stringify(next))
      } catch {
        // the list just does not survive a reload
      }
    }

    const unreadCount = createMemo(() => list().filter((r) => !r.read).length)

    /**
     * The one way in. Returns whether something was recorded. Not recorded:
     * categories handled elsewhere, a failure with no message, and a task that
     * is already in the list.
     */
    const record = (input: ErrorInput): boolean => {
      const message = input.message?.trim()
      if (!message || IGNORED.includes(input.category)) return false
      const cur = list()
      if (input.taskId && cur.some((r) => r.taskId === input.taskId)) {
        return false
      }
      const now = deps.now()
      const dup = cur.find(
        (r) =>
          r.source === input.source &&
          r.message === message &&
          now - r.at <= DEDUPE_MS,
      )
      if (dup) {
        commit(
          cur.map((r) =>
            r === dup ? { ...r, at: now, count: r.count + 1, read: false } : r,
          ),
        )
        return true
      }
      const rec: ErrorRecord = {
        id: `${now.toString(36)}-${++seq}`,
        at: now,
        category: input.category,
        source: input.source,
        message,
        detail: input.detail,
        href: input.href,
        taskId: input.taskId,
        read: false,
        count: 1,
      }
      commit([rec, ...cur].slice(0, MAX_RECORDS))
      return true
    }

    return {
      /** Newest first. */
      records: list,
      unreadCount,
      record,
      markAllRead: () => {
        if (unreadCount() > 0) commit(list().map((r) => ({ ...r, read: true })))
      },
      clear: () => batch(() => commit([])),
      dispose,
    }
  })

export type ErrorStore = ReturnType<typeof createErrorStore>
