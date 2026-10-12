// Tells a running task whose progress has stopped moving from one that is
// merely slow. The backends send no "progress last changed" time, so the store
// feeds every poll through this tracker and remembers when each task's
// progress fingerprint last changed.
import type { TaskProgress, UnifiedTask } from "~/platform/contracts/task"

/** A running task whose progress has not moved for longer than this is stale. */
export const STALE_MS = 60_000

/**
 * The progress numbers that move while a task works. A task that reports none
 * of them (an offline download without a percentage) cannot be judged, so it
 * has no fingerprint and is never marked.
 */
const fingerprint = (p: TaskProgress): string | undefined => {
  const parts = [p.percent, p.bytesDone, p.itemsDone, p.checksDone, p.scanned]
  return parts.some((v) => v !== undefined) ? parts.join("|") : undefined
}

export const createStallTracker = () => {
  const seen = new Map<string, { fp: string; since: number }>()
  let pausedAt: number | undefined
  let nowMs = 0

  return {
    /**
     * Polling stopped (the page went hidden). Time spent paused does not count
     * as time without progress: the next `track` moves every `since` forward
     * by the pause, so stalled time only accrues across visible polling.
     */
    pause: (at: number) => {
      pausedAt ??= at
    },

    /** Record one poll. Entries of tasks that are gone or no longer running are dropped. */
    track: (tasks: readonly UnifiedTask[], at: number) => {
      if (pausedAt !== undefined) {
        const gap = at - pausedAt
        pausedAt = undefined
        for (const e of seen.values()) e.since += gap
      }
      nowMs = at
      const live = new Set<string>()
      for (const t of tasks) {
        if (t.state !== "running") continue
        const fp = fingerprint(t.progress)
        if (fp === undefined) continue
        live.add(t.id)
        const prev = seen.get(t.id)
        if (!prev || prev.fp !== fp) seen.set(t.id, { fp, since: at })
      }
      for (const id of [...seen.keys()]) if (!live.has(id)) seen.delete(id)
    },

    /** The task with its progress time and `stale` filled in from what `track` saw. */
    stamp: (t: UnifiedTask): UnifiedTask => {
      const e = t.state === "running" ? seen.get(t.id) : undefined
      if (!e) return t
      return {
        ...t,
        progress: { ...t.progress, updatedAt: new Date(e.since).toISOString() },
        stale: nowMs - e.since > STALE_MS,
      }
    },

    clear: () => {
      seen.clear()
      pausedAt = undefined
    },
  }
}

export type StallTracker = ReturnType<typeof createStallTracker>
