import type { Storage } from "~/types"
import { showDiskUsage, usedPercentage } from "~/utils/storage"

export interface DriverDatum {
  name: string
  value: number
}

/** Count storages grouped by driver, sorted by count descending. */
export const driverDistribution = (storages: Storage[]): DriverDatum[] => {
  const counts = new Map<string, number>()
  for (const s of storages) {
    counts.set(s.driver, (counts.get(s.driver) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
}

export interface UsageDatum {
  name: string
  used: number
  free: number
  total: number
  percent: number
}

/** Per-storage capacity series, including only storages that report usage. */
export const storageUsageSeries = (storages: Storage[]): UsageDatum[] => {
  const out: UsageDatum[] = []
  for (const s of storages) {
    const d = s.mount_details
    if (!d || !showDiskUsage(d)) continue
    const total = d.total_space ?? 0
    const used = d.used_space ?? 0
    out.push({
      name: s.mount_path,
      used,
      free: Math.max(total - used, 0),
      total,
      percent: usedPercentage(d),
    })
  }
  return out
}
