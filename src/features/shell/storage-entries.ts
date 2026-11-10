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

/**
 * Mount points seen in listings, by path. A folder that carries mount_details
 * is a mount point and its name is the mount name; once inside, the current
 * path says which mount it is.
 */
export type MountNames = Map<string, string>

export const rememberMounts = (
  names: MountNames,
  dir: string,
  objs: readonly Pick<Obj, "name" | "mount_details">[],
) => {
  for (const o of objs) {
    if (o.mount_details) {
      names.set((dir === "/" ? "" : dir) + "/" + o.name, o.name)
    }
  }
}

/** The mount name for `path`: the longest remembered mount path that contains it. */
export const mountNameFor = (
  names: MountNames,
  path: string,
): string | undefined => {
  let best: string | undefined
  for (const mount of names.keys()) {
    if (
      (path === mount || path.startsWith(mount + "/")) &&
      (best === undefined || mount.length > best.length)
    ) {
      best = mount
    }
  }
  return best === undefined ? undefined : names.get(best)
}
