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
