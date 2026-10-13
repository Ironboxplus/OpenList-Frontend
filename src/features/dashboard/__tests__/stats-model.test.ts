import { describe, expect, it } from "vitest"
import type { StatsOverview } from "~/platform/api/stats"
import type { TaskState, UnifiedTask } from "~/platform/contracts/task"
import { dailyOption, speedOption } from "../stats-charts"
import {
  bytesText,
  durationText,
  mediaRows,
  recentSyncRuns,
  speedNow,
  speedText,
  trafficRows,
  transferDay,
} from "../stats-model"

const GB = 1024 ** 3
const c = (d = 0, u = 0, cd = 0, cu = 0) => ({
  server_download: d,
  server_upload: u,
  client_download: cd,
  client_upload: cu,
})
const overview = (over: Partial<StatsOverview["traffic"]> = {}) =>
  ({
    node: "",
    traffic: {
      now_bps: c(),
      series: [],
      today: c(),
      month: c(),
      total: c(),
      daily: [],
      ...over,
    },
    media: {
      movie: 0,
      tv: 0,
      anime: 0,
      collection: 0,
      episodes: 0,
      unscraped: 0,
    },
  }) satisfies StatsOverview

describe("units", () => {
  it("shows byte counts in human units and 0 as 0B (not '-')", () => {
    expect(bytesText(0)).toBe("0B")
    expect(bytesText(undefined)).toBe("0B")
    expect(bytesText(512)).toBe("512B")
    expect(bytesText(1536)).toBe("1.50K")
    expect(bytesText(12.3 * GB)).toBe("12.30G")
    expect(bytesText(2 * 1024 ** 4)).toBe("2.00T")
  })
  it("shows a speed as units per second", () => {
    expect(speedText(8 * 1024 ** 2)).toBe("8.00M/s")
    expect(speedText(0)).toBe("0B/s")
  })
})

describe("trafficRows / speedNow", () => {
  it("maps today, month and total with the two sides kept apart", () => {
    const rows = trafficRows(
      overview({
        today: c(3 * GB, 0, 2048, 1024),
        month: c(5 * GB, GB),
        total: c(1024 * GB, GB / 2),
      }),
    )
    expect(rows.map((r) => r.period)).toEqual(["today", "month", "total"])
    expect(rows[0]).toMatchObject({
      server: { down: "3.00G", up: "0B" },
      client: { down: "2.00K", up: "1.00K" },
    })
    expect(rows[2].server.down).toBe("1.00T")
  })
  it("is all zeros before any data arrived", () => {
    for (const r of trafficRows(undefined)) {
      expect(r.server).toEqual({ down: "0B", up: "0B" })
      expect(r.client).toEqual({ down: "0B", up: "0B" })
    }
    expect(speedNow(undefined)).toEqual({ down: "0B/s", up: "0B/s" })
  })
  it("reads the live speed from now_bps (server side)", () => {
    expect(
      speedNow(overview({ now_bps: c(8 * 1024 ** 2, 1024 ** 2) })),
    ).toEqual({ down: "8.00M/s", up: "1.00M/s" })
  })
})

describe("mediaRows", () => {
  it("groups thousands and flags only pending scrapes", () => {
    const rows = mediaRows({
      movie: 120,
      tv: 45,
      anime: 80,
      collection: 6,
      episodes: 3210,
      unscraped: 12,
    })
    expect(rows.find((r) => r.key === "episodes")!.value).toBe("3,210")
    expect(rows.filter((r) => r.attention).map((r) => r.key)).toEqual([
      "unscraped",
    ])
  })
  it("handles missing data and nothing pending", () => {
    expect(mediaRows(undefined).every((r) => r.value === "0")).toBe(true)
    expect(mediaRows(undefined).some((r) => r.attention)).toBe(false)
  })
})

const task = (
  state: TaskState,
  endedAt: string | undefined,
  type = "file.copy",
  extra: Partial<UnifiedTask> = {},
): UnifiedTask =>
  ({
    id: `${type}-${state}-${endedAt}-${Math.random()}`,
    type,
    state,
    endedAt,
    progress: {},
    ...extra,
  }) as UnifiedTask

describe("transferDay", () => {
  // 13 Oct 2026, 15:00 local time
  const now = new Date(2026, 9, 13, 15, 0, 0)
  const at = (d: number, h: number, m = 0) =>
    new Date(2026, 9, d, h, m, 0).toISOString()

  it("counts by the time a task ended, across the day boundary", () => {
    const tasks = [
      task("succeeded", at(13, 0, 0)), // right at midnight: today
      task("succeeded", at(13, 14)),
      task("partial_success", at(13, 9), "file.upload"),
      task("failed", at(13, 8), "file.upload"),
      task("succeeded", at(12, 23, 59)), // one minute before: yesterday
      task("failed", at(12, 1)),
      task("succeeded", at(14, 0, 0)), // tomorrow (clock skew): not today
      task("canceled", at(13, 10)), // neither done nor failed
      task("succeeded", undefined), // no end time
      task("running", undefined),
      task("queued", undefined),
    ]
    const d = transferDay(tasks, now)
    expect(d.active).toBe(2)
    expect(d.doneToday).toBe(3)
    expect(d.failedToday).toBe(1)
    expect(d.byType).toEqual([
      { type: "file.copy", done: 2, failed: 0 },
      { type: "file.upload", done: 1, failed: 1 },
    ])
  })

  it("is zero for no tasks, and when the day changes the old ones drop out", () => {
    expect(transferDay([], now)).toEqual({
      active: 0,
      doneToday: 0,
      failedToday: 0,
      byType: [],
    })
    const tasks = [task("succeeded", at(13, 14)), task("failed", at(13, 8))]
    expect(transferDay(tasks, now).doneToday).toBe(1)
    const nextDay = new Date(2026, 9, 14, 0, 5, 0)
    expect(transferDay(tasks, nextDay)).toMatchObject({
      doneToday: 0,
      failedToday: 0,
    })
  })

  it("skips a task whose end time cannot be read", () => {
    expect(transferDay([task("succeeded", "not a date")], now).doneToday).toBe(
      0,
    )
  })
})

describe("recentSyncRuns", () => {
  const run = (
    id: string,
    start: string,
    end: string | undefined,
    bytes: number,
  ) =>
    task(end ? "succeeded" : "running", end, "sync.copy", {
      id: `sync:${id}`,
      startedAt: start,
      source: { path: "/a" },
      destination: { path: "/b" },
      progress: { bytesDone: bytes } as UnifiedTask["progress"],
    })

  it("takes the latest five by start time, merges live and history, ignores other tasks", () => {
    const history = [1, 2, 3, 4, 5, 6].map((i) =>
      run(
        `h${i}`,
        `2026-10-0${i}T10:00:00Z`,
        `2026-10-0${i}T10:01:15Z`,
        i * 1000,
      ),
    )
    const live = [
      run("h6", "2026-10-06T10:00:00Z", undefined, 9999), // same job, still running
      task("running", undefined, "file.copy"), // not a sync job
    ]
    const out = recentSyncRuns(live, history)
    expect(out.map((r) => r.id)).toEqual([
      "sync:h6",
      "sync:h5",
      "sync:h4",
      "sync:h3",
      "sync:h2",
    ])
    expect(out[0]).toMatchObject({
      state: "running",
      bytes: 9999,
      durationMs: undefined,
    })
    expect(out[1]).toMatchObject({
      state: "succeeded",
      durationMs: 75_000,
      bytes: 5000,
    })
    expect(out[1].route).toBe("/a → /b")
  })

  it("is empty with no jobs", () => {
    expect(recentSyncRuns([], [])).toEqual([])
  })

  it("formats durations", () => {
    expect(durationText(undefined)).toBe("-")
    expect(durationText(200)).toBe("<1s")
    expect(durationText(42_000)).toBe("42s")
    expect(durationText(75_000)).toBe("1m15s")
    expect(durationText(3_725_000)).toBe("1h02m")
  })
})

describe("chart options", () => {
  const labels = { down: "Download", up: "Upload" }
  it("draws the speed series with one colour per direction and human axis units", () => {
    const o = speedOption(
      [
        { t: 1_760_000_000, ...c(1024, 0) },
        { t: 1_760_000_001, ...c(2048, 512) },
      ],
      labels,
    ) as any
    expect(o.series.map((s: any) => s.name)).toEqual(["Download", "Upload"])
    expect(o.series[0].data).toEqual([1024, 2048])
    expect(o.series[1].data).toEqual([0, 512])
    expect(o.yAxis.axisLabel.formatter(1024 * 1024)).toBe("1.00M/s")
    expect(o.tooltip.valueFormatter(2048)).toBe("2.00K/s")
    expect(o.legend.type).toBeUndefined() // never a paged legend
  })
  it("stacks 30 days with the same colours and byte units", () => {
    const days = [
      { day: "2026-10-12", ...c(GB, GB / 2) },
      { day: "2026-10-13", ...c(0, 0) },
    ]
    const o = dailyOption(days, labels) as any
    expect(o.xAxis.data).toEqual(["10-12", "10-13"])
    expect(o.series.every((s: any) => s.stack === "traffic")).toBe(true)
    expect(o.yAxis.axisLabel.formatter(GB)).toBe("1.00G")
    const s = speedOption([], labels) as any
    expect(o.series[0].color).toBe(s.series[0].color)
    expect(o.series[1].color).toBe(s.series[1].color)
  })
})
