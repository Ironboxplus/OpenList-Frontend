import { describe, expect, it } from "vitest"
import type { Storage } from "~/types"
import { storageUsageRows } from "../data"

const GB = 1024 ** 3
const st = (path: string, total?: number, used = 0, status = "work"): Storage =>
  ({
    mount_path: path,
    status,
    mount_details:
      total === undefined
        ? undefined
        : { total_space: total, used_space: used },
  }) as unknown as Storage

describe("storageUsageRows", () => {
  it("sorts by total capacity, biggest first, unknown last in given order", () => {
    const rows = storageUsageRows([
      st("/nodata"),
      st("/small", 10 * GB, GB),
      st("/big", 2048 * GB, 1024 * GB),
      st("/nodata2"),
    ])
    expect(rows.map((r) => r.path)).toEqual([
      "/big",
      "/small",
      "/nodata",
      "/nodata2",
    ])
    expect(rows[0]).toMatchObject({
      percent: 50,
      text: "1.00T / 2.00T",
      unknown: false,
    })
    expect(rows[2]).toMatchObject({ unknown: true, text: "" })
  })

  it("flags every storage that is not working", () => {
    const rows = storageUsageRows([
      st("/ok", GB, 0),
      st("/bad", GB, 0, "error"),
      st("/off", undefined, 0, "disabled"),
    ])
    expect(rows.map((r) => [r.path, r.failing])).toEqual([
      ["/ok", false],
      ["/bad", true],
      ["/off", true],
    ])
  })

  it("is empty without storages", () => {
    expect(storageUsageRows([])).toEqual([])
  })
})
