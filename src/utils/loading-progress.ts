export type StorageLoadState = "pending" | "loading" | "loaded" | "failed"

export interface StorageLoadItem {
  mount_path: string
  driver: string
  state: StorageLoadState
  error?: string
}

/** Mirrors the backend op.ProgressSnapshot returned by /admin/storage/loading. */
export interface LoadingSnapshot {
  total: number
  pending: number
  loading: number
  loaded: number
  failed: number
  finished: boolean
  items: StorageLoadItem[]
}

export interface LoadingSummary {
  total: number
  settled: number
  failed: number
  percent: number
  done: boolean
  hasFailures: boolean
}

/**
 * Reduce a backend loading snapshot to the few numbers the status bar renders.
 * `settled` counts storages that reached a terminal state (loaded or failed);
 * `percent` is settled/total (100 when there's nothing to load).
 */
export const loadingSummary = (s: LoadingSnapshot): LoadingSummary => {
  const settled = s.loaded + s.failed
  const percent = s.total === 0 ? 100 : Math.round((settled / s.total) * 100)
  return {
    total: s.total,
    settled,
    failed: s.failed,
    percent,
    done: s.finished || s.total === 0,
    hasFailures: s.failed > 0,
  }
}
