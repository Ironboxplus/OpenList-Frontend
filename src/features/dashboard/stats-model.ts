// What the statistics cards show: formatting and the mapping from the overview
// (and the transfer store's tasks) to card rows. Pure, so units, empty data and
// day boundaries are testable without rendering.
import type {
  MediaStats,
  StatsOverview,
  TrafficCounts,
} from "~/platform/api/stats"
import type { TaskState, UnifiedTask } from "~/platform/contracts/task"
import { getFileSize } from "~/utils/str"
import { sectionOf } from "../transfers/adapter"

/** getFileSize shows "-" for 0; a counter that is 0 says so. */
export const bytesText = (n: number | undefined): string =>
  n && n > 0 ? getFileSize(n) : "0B"

export const speedText = (bps: number | undefined): string =>
  `${bytesText(bps)}/s`

export const ZERO_COUNTS: TrafficCounts = {
  server_download: 0,
  server_upload: 0,
  client_download: 0,
  client_upload: 0,
}

export type Period = "today" | "month" | "total"
export const PERIODS: readonly Period[] = ["today", "month", "total"]

export interface TrafficRow {
  period: Period
  /** Between this node and the storages. */
  server: { down: string; up: string }
  /** Between this node and its clients (FTP, limited HTTP/WebDAV). */
  client: { down: string; up: string }
}

export const trafficRows = (o: StatsOverview | undefined): TrafficRow[] =>
  PERIODS.map((period) => {
    const c = o?.traffic[period] ?? ZERO_COUNTS
    return {
      period,
      server: {
        down: bytesText(c.server_download),
        up: bytesText(c.server_upload),
      },
      client: {
        down: bytesText(c.client_download),
        up: bytesText(c.client_upload),
      },
    }
  })

export const speedNow = (o: StatsOverview | undefined) => {
  const c = o?.traffic.now_bps ?? ZERO_COUNTS
  return { down: speedText(c.server_download), up: speedText(c.server_upload) }
}

export interface MediaRow {
  key: keyof MediaStats
  value: string
  /** Pending scrapes are the one number worth drawing the eye to. */
  attention: boolean
}

const MEDIA_KEYS: readonly (keyof MediaStats)[] = [
  "movie",
  "tv",
  "anime",
  "collection",
  "episodes",
  "unscraped",
]

export const mediaRows = (m: MediaStats | undefined): MediaRow[] =>
  MEDIA_KEYS.map((key) => ({
    key,
    value: (m?.[key] ?? 0).toLocaleString("en-US"),
    attention: key === "unscraped" && (m?.[key] ?? 0) > 0,
  }))

/** Midnight (local time) of the day `now` falls on. */
export const startOfDay = (now: Date): number =>
  new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()

export interface TransferDay {
  active: number
  doneToday: number
  failedToday: number
  /** Finished and failed tasks of the day per task type, most first. */
  byType: { type: string; done: number; failed: number }[]
}

const DONE: readonly TaskState[] = ["succeeded", "partial_success"]

/**
 * The day's counts from the transfer store's tasks, by the time each task
 * ended. Cancelled tasks are neither done nor failed; a task without a usable
 * end time is not counted as finished today.
 */
export const transferDay = (
  tasks: readonly UnifiedTask[],
  now: Date,
): TransferDay => {
  const from = startOfDay(now)
  const to = from + 24 * 3600 * 1000
  let active = 0
  let doneToday = 0
  let failedToday = 0
  const per = new Map<string, { done: number; failed: number }>()
  for (const t of tasks) {
    if (sectionOf(t.state) === "active") {
      active++
      continue
    }
    const ended = t.endedAt ? Date.parse(t.endedAt) : NaN
    if (!(ended >= from && ended < to)) continue
    const isDone = DONE.includes(t.state)
    if (!isDone && t.state !== "failed") continue
    if (isDone) doneToday++
    else failedToday++
    const row = per.get(t.type) ?? { done: 0, failed: 0 }
    if (isDone) row.done++
    else row.failed++
    per.set(t.type, row)
  }
  const byType = [...per.entries()]
    .map(([type, v]) => ({ type, ...v }))
    .sort((a, b) => b.done + b.failed - (a.done + a.failed))
  return { active, doneToday, failedToday, byType }
}

export interface SyncRun {
  id: string
  state: TaskState
  durationMs: number | undefined
  bytes: number | undefined
  /** "src -> dst" as the job names them. */
  route: string
}

const ms = (iso: string | undefined) => {
  const v = iso ? Date.parse(iso) : NaN
  return Number.isFinite(v) ? v : undefined
}

/** The latest runs, running ones included, newest start first. */
export const recentSyncRuns = (
  tasks: readonly UnifiedTask[],
  history: readonly UnifiedTask[],
  n = 5,
): SyncRun[] => {
  const byId = new Map<string, UnifiedTask>()
  // A running job is in both lists for a moment; the live copy is fresher.
  for (const t of history) if (t.type.startsWith("sync.")) byId.set(t.id, t)
  for (const t of tasks) if (t.type.startsWith("sync.")) byId.set(t.id, t)
  return [...byId.values()]
    .sort((a, b) => (ms(b.startedAt) ?? 0) - (ms(a.startedAt) ?? 0))
    .slice(0, n)
    .map((t) => {
      const start = ms(t.startedAt)
      const end = ms(t.endedAt)
      return {
        id: t.id,
        state: t.state,
        durationMs:
          start !== undefined && end !== undefined
            ? Math.max(0, end - start)
            : undefined,
        bytes: t.progress.bytesDone,
        route: `${t.source?.path ?? "?"} → ${t.destination?.path ?? "?"}`,
      }
    })
}

/** 75s -> "1m15s"; under half a second "<1s"; unknown "-". */
export const durationText = (msec: number | undefined): string => {
  if (msec === undefined) return "-"
  const s = Math.round(msec / 1000)
  if (s < 1) return "<1s"
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m${String(s % 60).padStart(2, "0")}s`
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}m`
}
