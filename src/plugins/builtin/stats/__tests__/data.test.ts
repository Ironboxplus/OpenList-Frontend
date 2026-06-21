import { describe, it, expect } from "vitest"
import { driverDistribution, storageUsageSeries } from "../data"
import type { Storage } from "~/types"

function storage(partial: Partial<Storage>): Storage {
  return {
    id: 1,
    mount_path: "/s",
    order: 0,
    driver: "Local",
    status: "work",
    ...partial,
  } as Storage
}

describe("driverDistribution", () => {
  it("counts storages per driver", () => {
    const data = driverDistribution([
      storage({ driver: "Local" }),
      storage({ driver: "Local" }),
      storage({ driver: "OneDrive" }),
    ])
    expect(data).toEqual([
      { name: "Local", value: 2 },
      { name: "OneDrive", value: 1 },
    ])
  })

  it("returns an empty array for no storages", () => {
    expect(driverDistribution([])).toEqual([])
  })

  it("sorts by count descending", () => {
    const data = driverDistribution([
      storage({ driver: "A" }),
      storage({ driver: "B" }),
      storage({ driver: "B" }),
    ])
    expect(data[0]).toEqual({ name: "B", value: 2 })
  })
})

describe("storageUsageSeries", () => {
  it("includes only storages that report capacity", () => {
    const data = storageUsageSeries([
      storage({
        mount_path: "/a",
        mount_details: {
          total_space: 100,
          used_space: 40,
          driver_name: "Local",
        },
      }),
      storage({ mount_path: "/b" }), // no details
    ])
    expect(data).toHaveLength(1)
    expect(data[0].name).toBe("/a")
    expect(data[0].used).toBe(40)
    expect(data[0].free).toBe(60)
  })

  it("computes percent used and clamps to 100", () => {
    const data = storageUsageSeries([
      storage({
        mount_path: "/full",
        mount_details: {
          total_space: 100,
          used_space: 150,
          driver_name: "X",
        },
      }),
    ])
    expect(data[0].percent).toBe(100)
  })

  it("returns empty when nothing reports usage", () => {
    expect(storageUsageSeries([storage({ mount_path: "/x" })])).toEqual([])
  })
})
