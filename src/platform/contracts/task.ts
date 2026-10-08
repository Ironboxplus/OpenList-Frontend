// Task / Progress / Error contract, copied from REFACTOR_PLAN §5.1.
// ObjectRef is the minimal form for now; `legacy` is a UI-batch-1 extension
// that disappears once the backend serves /api/tasks natively.

export type TaskState =
  | "queued"
  | "running"
  | "waiting_retry"
  | "recovering"
  | "canceling"
  | "canceled"
  | "failed"
  | "succeeded"
  | "partial_success"

export interface ObjectRef {
  path: string
  storage?: string
}

export interface TaskProgress {
  bytesDone?: number
  bytesTotal?: number
  itemsDone?: number
  itemsTotal?: number
  /** Sync only: files compared so far / expected, and entries listed. */
  checksDone?: number
  checksTotal?: number
  scanned?: number
  percent?: number
  speedBytesPerSecond?: number
  etaMs?: number
  updatedAt: string
}

export type ErrorCategory =
  | "network"
  | "timeout"
  | "canceled"
  | "auth"
  | "permission"
  | "validation"
  | "conflict"
  | "rate_limited"
  | "provider"
  | "driver"
  | "task"
  | "player"
  | "plugin"
  | "cluster"
  | "internal"

export interface UnifiedError {
  code: string
  category: ErrorCategory
  message: string
  retryable: boolean
  retryAfterMs?: number
  actions: string[]
  source?: string
  provider?: string
  httpStatus?: number
  requestId?: string
  correlationId?: string
  attempt?: number
  occurredAt: string
  details?: unknown
  causeChain?: string[]
}

/** Mirrors internal/syncjob Snapshot JSON (OP-sync feat/sync). */
export interface SyncSpec {
  mode: "copy" | "sync" | "bisync" | "check"
  src: string
  dst: string
  dry_run: boolean
  size_only: boolean
  track_renames: boolean
  resync: boolean
  force: boolean
  filters: string[]
  transfers: number
  checkers: number
  max_delete?: number
  /** Zip each directory's small files into packs at dst (copy / sync). */
  pack?: PackOptions
  /** Extract packs found at src (copy / sync); not combinable with pack. */
  unpack?: boolean
}

/** Mirrors internal/syncjob PackOptions; GET /admin/sync/pack_defaults has the defaults. */
export interface PackOptions {
  enabled: boolean
  threshold: number
  /** Absent on backends that pack per job instead of per folder. */
  min_files?: number
  max_pack_bytes: number
  store_suffixes?: string[]
}

/**
 * Mirrors internal/syncjob PackStats. Backends differ in which fields they
 * send (older: dirs, skipped_dirs, packs; job-level packs: small_files,
 * packs_written, packs_total, ...), so everything is optional and the UI
 * renders whatever is present.
 */
export interface PackStats {
  small_files?: number
  packed_files?: number
  /** Older backends call this `packs`. */
  packs?: number
  packs_written?: number
  packs_total?: number
  bytes_in?: number
  bytes_out?: number
  dead_removed?: number
  compacted_packs?: number
  /** A loose copy at dst that differs from the packed member; it was kept. */
  conflicts?: number
  loose_removed?: number
  v1_migrated_dirs?: number
  unpacked_files?: number
  unpacked_bytes?: number
  packs_fetched?: number
  packs_ranged?: number
}

export interface SyncCounters {
  match: number
  differ: number
  only_in_src: number
  only_in_dst: number
  errors: number
  uploaded: number
  uploaded_bytes: number
  rapid_uploads: number
  rapid_bytes: number
}

export type SyncEventKind =
  | "only_in_src"
  | "only_in_dst"
  | "differ"
  | "error"
  | "uploaded"
  | "rapid"

export interface SyncEvent {
  time: string
  kind: SyncEventKind
  path: string
  size?: number
  error?: string
}

/** rclone core/stats entry for a file in flight. */
export interface SyncTransferring {
  name: string
  size: number
  bytes: number
  percentage: number
  speed: number
  speedAvg?: number
  eta?: number | null
}

export interface SyncStats {
  bytes?: number
  totalBytes?: number
  transfers?: number
  totalTransfers?: number
  checks?: number
  totalChecks?: number
  listed?: number
  speed?: number
  /** seconds; null/absent when unknown */
  eta?: number | null
  errors?: number
  deletes?: number
  renames?: number
  transferring?: SyncTransferring[]
  [k: string]: unknown
}

export interface SyncSnapshot {
  id: string
  spec: SyncSpec
  state: "running" | "succeeded" | "failed" | "canceled"
  error?: string
  started_at: string
  ended_at?: string
  counters: SyncCounters
  stats?: SyncStats
  /** "packing" / "unpacking" while small files are handled, then "transferring". */
  stage?: string
  pack_stats?: PackStats
  events?: SyncEvent[]
}

/**
 * `done` (tache only) records which legacy list the task came from: the
 * undone/done endpoints take different actions, so the UI must not guess.
 */
export type LegacyInfo =
  | {
      kind: "tache"
      tacheType: string
      rawState: number
      name: string
      done: boolean
    }
  | { kind: "sync"; snapshot: SyncSnapshot }

export interface UnifiedTask {
  id: string
  type: string
  state: TaskState
  phase: string
  parentId?: string
  groupId?: string
  creatorId?: string
  ownerNode?: string
  attempt: number
  maxAttempts: number
  retryable: boolean
  source?: ObjectRef
  destination?: ObjectRef
  progress: TaskProgress
  checkpoint?: unknown
  error?: UnifiedError
  createdAt: string
  startedAt?: string
  updatedAt: string
  endedAt?: string
  version: number
  correlationId: string
  legacy: LegacyInfo
}
