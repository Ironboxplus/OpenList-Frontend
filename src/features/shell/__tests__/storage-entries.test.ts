import { describe, expect, it } from "vitest"
import type { MountDetails } from "~/types"
import { storageEntries } from "../storage-entries"

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
