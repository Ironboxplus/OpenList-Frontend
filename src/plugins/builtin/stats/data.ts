import type { Storage } from "~/types"
import { getFileSize } from "~/utils/str"
import { showDiskUsage, usedPercentage } from "~/utils/storage"

export interface UsageRow {
  path: string
  /** Bytes; undefined for a storage that does not report its capacity. */
  used?: number
  total?: number
  percent: number
  /** The storage does not report capacity. */
  unknown: boolean
  /** Status is not "work": shown in red and opens the storages page. */
  failing: boolean
  status: string
  /** "used / total" in human units, or empty when unknown. */
  text: string
}

const bytes = (n: number) => (n > 0 ? getFileSize(n) : "0B")

/**
 * One row per storage, biggest first; storages that cannot say how big they
 * are come last, in the order they were given.
 */
export const storageUsageRows = (storages: Storage[]): UsageRow[] => {
  const rows = storages.map((s): UsageRow => {
    const d = s.mount_details
    const known = !!showDiskUsage(d)
    const used = Math.max(d?.used_space ?? 0, 0)
    return {
      path: s.mount_path,
      used: known ? used : undefined,
      total: known ? d!.total_space! : undefined,
      percent: known ? usedPercentage(d!) : 0,
      unknown: !known,
      failing: s.status !== "work",
      status: s.status,
      text: known ? `${bytes(used)} / ${bytes(d!.total_space!)}` : "",
    }
  })
  const known = rows
    .filter((r) => !r.unknown)
    .sort((a, b) => b.total! - a.total!)
  return [...known, ...rows.filter((r) => r.unknown)]
}
