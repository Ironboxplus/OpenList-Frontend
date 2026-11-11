import { describe, expect, it } from "vitest"
import type { MountDetails } from "~/types"
import {
  mountNameFor,
  rememberMounts,
  storageEntries,
} from "../storage-entries"

const GB = 1024 ** 3
const local: MountDetails = {
  driver_name: "Local",
  total_space: 100 * GB,
  used_space: 40 * GB,
  free_space: 60 * GB,
}

describe("storageEntries", () => {
  it("shows the storage being browsed, under its driver", () => {
    const objs = [{ name: "a", mount_details: local }]
    expect(storageEntries(local, objs)).toEqual([
      { name: "Local", details: local },
    ])
  })

  it("titles the card with the last segment of the mount path the backend sends", () => {
    const d = { ...local, driver_name: "115 Open", mount_path: "/网盘/115" }
    expect(storageEntries(d, [])[0].name).toBe("115")
    // it wins over a name remembered from a listing
    expect(storageEntries(d, [], "other")[0].name).toBe("115")
    // an older backend sends no mount_path: the remembered name, then the driver
    expect(storageEntries(local, [], "remembered")[0].name).toBe("remembered")
    // a storage mounted at the root has no segment to use
    expect(storageEntries({ ...local, mount_path: "/" }, [])[0].name).toBe(
      "Local",
    )
  })

  it("lists the mount points that report usage at the storages root", () => {
    const objs = [
      { name: "disk", mount_details: local },
      { name: "plain folder" },
      { name: "no-usage", mount_details: { driver_name: "X", total_space: 0 } },
    ]
    expect(storageEntries(undefined, objs)).toEqual([
      { name: "disk", details: local },
    ])
  })

  it("is empty when nothing reports usage; an unknown driver has no name", () => {
    expect(storageEntries(undefined, [{ name: "f" }])).toEqual([])
    expect(
      storageEntries({ ...local, driver_name: "unknown" }, [])[0].name,
    ).toBe("")
  })
})

describe("mount names", () => {
  it("names the storage after its mount, by the longest remembered prefix", () => {
    const names = new Map<string, string>()
    rememberMounts(names, "/", [
      { name: "示例", mount_details: local },
      { name: "plain" },
    ])
    rememberMounts(names, "/示例", [{ name: "nested", mount_details: local }])
    expect(mountNameFor(names, "/示例")).toBe("示例")
    expect(mountNameFor(names, "/示例/照片/2026")).toBe("示例")
    expect(mountNameFor(names, "/示例/nested/x")).toBe("nested")
    expect(mountNameFor(names, "/示例2")).toBeUndefined()
    expect(mountNameFor(names, "/plain")).toBeUndefined()
  })

  it("uses the mount name over the driver, the driver without one", () => {
    expect(storageEntries(local, [], "示例")[0].name).toBe("示例")
    expect(storageEntries(local, [])[0].name).toBe("Local")
  })
})
