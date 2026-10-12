// Adapter between the legacy task endpoints (tache + sync jobs) and the
// UnifiedTask contract of REFACTOR_PLAN §5.1. Everything above this file only
// sees UnifiedTask; when the backend serves /api/tasks natively, only this
// file and ./api.ts are replaced.
import { packStage } from "./pack"
import type {
  ObjectRef,
  SyncSnapshot,
  SyncStats,
  TaskProgress,
  TaskState,
  UnifiedError,
  UnifiedTask,
} from "~/platform/contracts/task"
import {
  COPY_NAME,
  DECOMPRESS_NAME,
  DECOMPRESS_UPLOAD_NAME,
  MOVE_NAME,
  OFFLINE_DOWNLOAD_NAME,
  OFFLINE_TRANSFER_NAME,
  UPLOAD_NAME,
} from "./task-names"

/** Raw item of GET /api/task/{type}/{undone|done}. */
export interface TacheRaw {
  id: string
  name: string
  creator: string
  creator_role: number
  state: number
  status: string
  progress: number
  start_time: string | null
  end_time: string | null
  total_bytes: number
  error: string
}

export const TACHE_TYPES = [
  "upload",
  "copy",
  "move",
  "offline_download",
  "offline_download_transfer",
  "decompress",
  "decompress_upload",
] as const
export type TacheType = (typeof TACHE_TYPES)[number]

export const TYPE_MAP: Record<TacheType, string> = {
  upload: "file.upload",
  copy: "file.copy",
  move: "file.move",
  offline_download: "offline.download",
  offline_download_transfer: "offline.transfer",
  decompress: "archive.extract",
  decompress_upload: "archive.upload",
}

export type TaskAction =
  | "cancel"
  | "delete"
  | "retry"
  | "clear_done"
  | "clear_succeeded"
  | "retry_failed"

const ALL_BULK: readonly TaskAction[] = [
  "cancel",
  "delete",
  "clear_done",
  "clear_succeeded",
]

/** Which legacy endpoints each type supports; retry follows Tasks.tsx canRetry. */
export const TACHE_OPS: Record<TacheType, readonly TaskAction[]> = {
  upload: ALL_BULK,
  copy: [...ALL_BULK, "retry", "retry_failed"],
  move: [...ALL_BULK, "retry", "retry_failed"],
  offline_download: [...ALL_BULK, "retry", "retry_failed"],
  offline_download_transfer: [...ALL_BULK, "retry", "retry_failed"],
  decompress: [...ALL_BULK, "retry", "retry_failed"],
  decompress_upload: [...ALL_BULK, "retry", "retry_failed"],
}

export const isTacheType = (s: string): s is TacheType =>
  (TACHE_TYPES as readonly string[]).includes(s)

/** tache v0.2.2 state values, see tache/state.go. */
export const mapTacheState = (raw: number): TaskState => {
  switch (raw) {
    case 1:
      return "running"
    case 2:
      return "succeeded"
    case 3:
      return "canceling"
    case 4:
      return "canceled"
    case 5:
      return "waiting_retry"
    case 6:
    case 7:
      return "failed"
    default:
      return "queued"
  }
}

const isUsableTime = (s?: string | null): s is string =>
  !!s && !Number.isNaN(Date.parse(s)) && Date.parse(s) > Date.UTC(1971, 0, 1)

const fullPath = (device: string, path: string) =>
  (device === "/" ? "" : device) + path

const ref = (device: string, path: string): ObjectRef => ({
  path: fullPath(device, path),
  storage: device || undefined,
})

/** Parse the free-text name of a legacy task into source/destination. */
export const parseTaskName = (
  type: TacheType,
  name: string,
): { source?: ObjectRef; destination?: ObjectRef } => {
  let m: RegExpMatchArray | null
  switch (type) {
    case "copy":
    case "move":
      m = name.match(type === "copy" ? COPY_NAME : MOVE_NAME)
      return m ? { source: ref(m[1], m[3]), destination: ref(m[5], m[6]) } : {}
    case "upload":
    case "decompress_upload":
      m = name.match(type === "upload" ? UPLOAD_NAME : DECOMPRESS_UPLOAD_NAME)
      return m ? { source: { path: m[1] }, destination: ref(m[2], m[3]) } : {}
    case "offline_download":
      m = name.match(OFFLINE_DOWNLOAD_NAME)
      return m ? { source: { path: m[1] }, destination: { path: m[2] } } : {}
    case "offline_download_transfer":
      m = name.match(OFFLINE_TRANSFER_NAME)
      if (!m) return {}
      return {
        // "upload" tasks carry the download URL, "transfer" a path in a
        // storage (or a bare local path when the storage part is empty).
        source:
          m[1] === "transfer" && m[2] !== "" ? ref(m[2], m[3]) : { path: m[3] },
        destination: ref(m[5], m[6]),
      }
    case "decompress":
      m = name.match(DECOMPRESS_NAME)
      return m ? { source: ref(m[1], m[2]), destination: ref(m[5], m[6]) } : {}
  }
}

export const mapTache = (
  raw: TacheRaw,
  type: TacheType,
  done: boolean,
  now: Date,
): UnifiedTask => {
  const state = mapTacheState(raw.state)
  const nowIso = now.toISOString()
  const startedAt = isUsableTime(raw.start_time) ? raw.start_time : undefined
  const endedAt = isUsableTime(raw.end_time) ? raw.end_time : undefined
  // The backend reports no progress time: a finished task last moved when it
  // ended; for a running one the store fills in when its numbers last changed.
  const touchedAt = endedAt ?? startedAt ?? nowIso
  const progress: TaskProgress = { updatedAt: touchedAt }
  // The backend fills NaN progress with 100, so a running task at 100 has no
  // real percentage.
  if (!(state === "running" && raw.progress === 100)) {
    progress.percent = raw.progress
  }
  if (raw.total_bytes > 0) progress.bytesTotal = raw.total_bytes
  const error: UnifiedError | undefined = raw.error
    ? {
        code: "task_error",
        category: "task",
        message: raw.error,
        retryable: true,
        actions: [],
        occurredAt: endedAt ?? nowIso,
      }
    : undefined
  const { source, destination } = parseTaskName(type, raw.name)
  return {
    id: `${type}:${raw.id}`,
    type: TYPE_MAP[type],
    state,
    phase: raw.status,
    creatorId: raw.creator || undefined,
    attempt: 1,
    maxAttempts: 1,
    retryable: done && state === "failed" && TACHE_OPS[type].includes("retry"),
    source,
    destination,
    progress,
    error,
    createdAt: startedAt ?? nowIso,
    startedAt,
    updatedAt: touchedAt,
    endedAt,
    version: 1,
    correlationId: raw.id,
    legacy: {
      kind: "tache",
      tacheType: type,
      rawState: raw.state,
      name: raw.name,
      done,
    },
  }
}

const finite = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) ? v : undefined

export type SyncPhase = "checking" | "transferring"

/**
 * A running sync first lists and compares both sides; until the first byte is
 * queued, bytes/files are legitimately 0. Nothing queued yet while comparisons
 * exist means we are still checking.
 */
export const syncPhase = (stats: SyncStats | undefined): SyncPhase => {
  const s = stats ?? {}
  const checks = finite(s.checks) ?? 0
  const transfers = finite(s.transfers) ?? 0
  const totalTransfers = finite(s.totalTransfers) ?? 0
  return transfers === 0 && totalTransfers === 0 && checks > 0
    ? "checking"
    : "transferring"
}

export const mapSyncSnapshot = (snap: SyncSnapshot, now: Date): UnifiedTask => {
  const nowIso = now.toISOString()
  const stats = snap.stats ?? {}
  const finished = snap.state !== "running"
  const bytesDone = finite(stats.bytes)
  const bytesTotal = finite(stats.totalBytes)
  const startedAt = isUsableTime(snap.started_at) ? snap.started_at : nowIso
  const endedAt = isUsableTime(snap.ended_at) ? snap.ended_at : undefined
  // A snapshot has no progress time either; see mapTache.
  const touchedAt = endedAt ?? startedAt
  const progress: TaskProgress = { updatedAt: touchedAt }
  if (bytesDone !== undefined) progress.bytesDone = bytesDone
  if (bytesTotal !== undefined) progress.bytesTotal = bytesTotal
  const itemsDone = finite(stats.transfers)
  const itemsTotal = finite(stats.totalTransfers)
  if (itemsDone !== undefined) progress.itemsDone = itemsDone
  if (itemsTotal !== undefined) progress.itemsTotal = itemsTotal
  const speed = finite(stats.speed)
  if (speed !== undefined) progress.speedBytesPerSecond = speed
  const checksDone = finite(stats.checks)
  const checksTotal = finite(stats.totalChecks)
  const scanned = finite(stats.listed)
  if (checksDone !== undefined) progress.checksDone = checksDone
  if (checksTotal !== undefined) progress.checksTotal = checksTotal
  if (scanned !== undefined) progress.scanned = scanned
  const eta = finite(stats.eta)
  if (eta !== undefined) progress.etaMs = eta * 1000
  // rclone grows totalBytes while it is still scanning, so a percentage taken
  // mid-run would mislead; only a finished job has a trustworthy denominator.
  if (finished) {
    if (bytesDone !== undefined && bytesTotal !== undefined && bytesTotal > 0) {
      progress.percent = Math.min(100, (bytesDone / bytesTotal) * 100)
    } else if (snap.state === "succeeded") {
      progress.percent = 100
    }
  }
  return {
    id: `sync:${snap.id}`,
    type: `sync.${snap.spec.mode}`,
    state: snap.state,
    phase: finished
      ? snap.state
      : (packStage(snap.stage) ?? syncPhase(snap.stats)),
    attempt: 1,
    maxAttempts: 1,
    retryable: false,
    source: { path: snap.spec.src },
    destination: { path: snap.spec.dst },
    progress,
    error: snap.error
      ? {
          code: "sync_error",
          category: "task",
          message: snap.error,
          retryable: false,
          actions: [],
          occurredAt: endedAt ?? nowIso,
        }
      : undefined,
    createdAt: startedAt,
    startedAt,
    updatedAt: touchedAt,
    endedAt,
    version: 1,
    correlationId: snap.id,
    legacy: { kind: "sync", snapshot: snap },
  }
}

export type Section = "active" | "failed" | "done"

export const sectionOf = (state: TaskState): Section => {
  switch (state) {
    case "failed":
      return "failed"
    case "succeeded":
    case "canceled":
    case "partial_success":
      return "done"
    default:
      return "active"
  }
}

/** Per-task actions; bulk actions come from TACHE_OPS. */
export const availableActions = (t: UnifiedTask): TaskAction[] => {
  const lg = t.legacy
  if (lg.kind === "sync") return t.state === "running" ? ["cancel"] : []
  if (!lg.done) return ["cancel"]
  const acts: TaskAction[] = ["delete"]
  if (t.retryable) acts.unshift("retry")
  return acts
}

export const bulkActions = (type: TacheType): readonly TaskAction[] =>
  TACHE_OPS[type].filter(
    (a) => a !== "cancel" && a !== "delete" && a !== "retry",
  )

/** Newest first; a stable order keeps cards from jumping between polls. */
export const sortTasks = (tasks: UnifiedTask[]): UnifiedTask[] =>
  [...tasks].sort((a, b) => {
    const d = Date.parse(b.createdAt) - Date.parse(a.createdAt)
    return d !== 0 ? d : a.id < b.id ? -1 : 1
  })

// ---- filter chips -------------------------------------------------------

export const FILTER_KEYS = [
  "all",
  "upload",
  "copy",
  "move",
  "offline",
  "decompress",
  "sync",
] as const
export type FilterKey = (typeof FILTER_KEYS)[number]

export const isFilterKey = (s: unknown): s is FilterKey =>
  typeof s === "string" && (FILTER_KEYS as readonly string[]).includes(s)

export const filterKeyOf = (type: string): FilterKey => {
  switch (type) {
    case "file.upload":
      return "upload"
    case "file.copy":
      return "copy"
    case "file.move":
      return "move"
    case "offline.download":
    case "offline.transfer":
      return "offline"
    case "archive.extract":
    case "archive.upload":
      return "decompress"
    default:
      return type.startsWith("sync.") ? "sync" : "all"
  }
}

export const matchesFilter = (t: UnifiedTask, key: FilterKey): boolean =>
  key === "all" || filterKeyOf(t.type) === key

/** Old `/@manage/tasks/:type` segment to the new `?type=` value. */
export const legacyTypeToFilter = (type: string | undefined): FilterKey => {
  if (!type) return "all"
  if (isTacheType(type)) return filterKeyOf(TYPE_MAP[type])
  return "all"
}

/** Tache types the bulk actions of a filter chip apply to. */
export const tacheTypesOf = (key: FilterKey): TacheType[] =>
  TACHE_TYPES.filter((t) => key === "all" || filterKeyOf(TYPE_MAP[t]) === key)

// ---- Task Center drawer -------------------------------------------------

export const DRAWER_LIMIT = 10
export const DRAWER_RECENT_MS = 10 * 60 * 1000

/** Running tasks, plus anything that ended in the last ten minutes. */
export const drawerTasks = (tasks: UnifiedTask[], now: number): UnifiedTask[] =>
  sortTasks(
    tasks.filter((t) => {
      if (sectionOf(t.state) === "active") return true
      const end = t.endedAt ? Date.parse(t.endedAt) : NaN
      return Number.isFinite(end) && now - end <= DRAWER_RECENT_MS
    }),
  ).slice(0, DRAWER_LIMIT)

// ---- display ------------------------------------------------------------

/** What a card shows as its title: `source → destination`, else the raw name. */
export const taskTitle = (
  t: UnifiedTask,
): { from?: string; to?: string; text: string } => {
  const from = t.source?.path
  const to = t.destination?.path
  if (from && to) return { from, to, text: `${from} → ${to}` }
  if (t.legacy.kind === "tache") return { text: t.legacy.name }
  return { text: to ?? from ?? t.id }
}
