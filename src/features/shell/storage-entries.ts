import type { MountDetails, Obj } from "~/types"
import { showDiskUsage } from "~/utils"

export interface StorageEntry {
  /** The mount point's name; the driver's for the storage being browsed. */
  name: string
  details: MountDetails
}

/** How many mount points the card lists before "show all". */
export const COLLAPSED_COUNT = 3

/**
 * What the storage card shows: the storage of the current folder, or, where
 * there is none (the storages root), the mount points that report their usage.
 */
export const storageEntries = (
  current: MountDetails | undefined,
  objs: readonly Pick<Obj, "name" | "mount_details">[],
): StorageEntry[] => {
  if (current && showDiskUsage(current)) {
    const driver = current.driver_name
    return [
      {
        name: driver.toLowerCase() === "unknown" ? "" : driver,
        details: current,
      },
    ]
  }
  return objs
    .filter((o) => showDiskUsage(o.mount_details))
    .map((o) => ({ name: o.name, details: o.mount_details! }))
}
