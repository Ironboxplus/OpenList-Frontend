import { describe, expect, it } from "vitest"
import type { SyncSnapshot } from "~/platform/contracts/task"
import {
  availableActions,
  bulkActions,
  drawerTasks,
  filterKeyOf,
  legacyTypeToFilter,
  mapSyncSnapshot,
  mapTache,
  mapTacheState,
  syncPhase,
  parseTaskName,
  sectionOf,
  taskTitle,
  TACHE_TYPES,
  TYPE_MAP,
  type TacheRaw,
  type TacheType,
} from "../adapter"

const NOW = new Date("2026-10-08T10:00:00Z")

const raw = (over: Partial<TacheRaw> = {}): TacheRaw => ({
  id: "t1",
  name: "copy [/a](/dir/x.mkv) to [/b](/out)",
  creator: "admin",
  creator_role: 2,
  state: 1,
  status: "copying",
  progress: 40,
  start_time: "2026-10-08T09:59:00Z",
  end_time: null,
  total_bytes: 1000,
  error: "",
  ...over,
})

describe("type mapping", () => {
  it.each([
    ["upload", "file.upload"],
    ["copy", "file.copy"],
    ["move", "file.move"],
    ["offline_download", "offline.download"],
    ["offline_download_transfer", "offline.transfer"],
    ["decompress", "archive.extract"],
    ["decompress_upload", "archive.upload"],
  ])("%s -> %s", (legacy, unified) => {
    expect(TYPE_MAP[legacy as TacheType]).toBe(unified)
    expect(mapTache(raw(), legacy as TacheType, false, NOW).type).toBe(unified)
  })
  it("covers all seven legacy types", () => {
    expect(TACHE_TYPES).toHaveLength(7)
  })
})

describe("state mapping", () => {
  it.each([
    [0, "queued"],
    [1, "running"],
    [2, "succeeded"],
    [3, "canceling"],
    [4, "canceled"],
    [5, "waiting_retry"],
    [6, "failed"],
    [7, "failed"],
    [8, "queued"],
    [9, "queued"],
    [42, "queued"],
  ])("tache %i -> %s", (n, s) => {
    expect(mapTacheState(n)).toBe(s)
  })
})

describe("progress", () => {
  it("passes percent through", () => {
    const t = mapTache(raw({ progress: 40 }), "copy", false, NOW)
    expect(t.progress.percent).toBe(40)
    expect(t.progress.bytesTotal).toBe(1000)
    expect(t.progress.updatedAt).toBe(NOW.toISOString())
  })
  it("treats running + 100 as unknown", () => {
    const t = mapTache(raw({ state: 1, progress: 100 }), "copy", false, NOW)
    expect(t.progress.percent).toBeUndefined()
  })
  it("keeps 100 for a succeeded task", () => {
    const t = mapTache(raw({ state: 2, progress: 100 }), "copy", true, NOW)
    expect(t.progress.percent).toBe(100)
  })
  it("omits bytesTotal when not positive", () => {
    const t = mapTache(raw({ total_bytes: 0 }), "copy", false, NOW)
    expect(t.progress.bytesTotal).toBeUndefined()
  })
})

describe("name parsing", () => {
  it.each<[TacheType, string, string | undefined, string | undefined]>([
    ["copy", "copy [/a](/dir/x.mkv) to [/b](/out)", "/a/dir/x.mkv", "/b/out"],
    ["copy", "merge [/a](/dir/) to [/b](/out)", "/a/dir/", "/b/out"],
    ["move", "move [/](/x/y) to [/b](/z)", "/x/y", "/b/z"],
    ["upload", "upload f.bin to [/b](/dir/f.bin)", "f.bin", "/b/dir/f.bin"],
    ["offline_download", "download http://h/f to (/dl)", "http://h/f", "/dl"],
    [
      "offline_download_transfer",
      "transfer [/a](/d/f.mkv) to [/b](/out)",
      "/a/d/f.mkv",
      "/b/out",
    ],
    [
      "offline_download_transfer",
      "transfer [](/tmp/dl/f.mkv) to [/b](/out)",
      "/tmp/dl/f.mkv",
      "/b/out",
    ],
    [
      "decompress",
      "decompress [/a](/p.zip)[in] to [/b](/out) with password <pw>",
      "/a/p.zip",
      "/b/out",
    ],
    ["decompress_upload", "upload f to [/b](/out/f)", "f", "/b/out/f"],
  ])("%s: %s", (type, name, src, dst) => {
    const p = parseTaskName(type, name)
    expect(p.source?.path).toBe(src)
    expect(p.destination?.path).toBe(dst)
  })

  it("never leaks the decompress password into the title", () => {
    const t = mapTache(
      raw({
        name: "decompress [/a](/p.zip)[in] to [/b](/out) with password <s3cret>",
      }),
      "decompress",
      false,
      NOW,
    )
    expect(taskTitle(t).text).not.toContain("s3cret")
  })

  it("falls back to the raw name when it cannot be parsed", () => {
    const t = mapTache(
      raw({ name: "something unexpected" }),
      "copy",
      false,
      NOW,
    )
    expect(t.source).toBeUndefined()
    expect(t.destination).toBeUndefined()
    expect(taskTitle(t).text).toBe("something unexpected")
  })

  it("titles parsed tasks as source -> destination", () => {
    const t = mapTache(raw(), "copy", false, NOW)
    expect(taskTitle(t)).toEqual({
      from: "/a/dir/x.mkv",
      to: "/b/out",
      text: "/a/dir/x.mkv → /b/out",
    })
  })
})

describe("error", () => {
  it("fills a task-category UnifiedError", () => {
    const t = mapTache(raw({ state: 7, error: "boom" }), "copy", true, NOW)
    expect(t.error).toMatchObject({
      category: "task",
      retryable: true,
      message: "boom",
    })
  })
  it("has no error when the backend reports none", () => {
    expect(mapTache(raw(), "copy", false, NOW).error).toBeUndefined()
  })
})

describe("actions", () => {
  const t = (type: TacheType, state: number, done: boolean) =>
    mapTache(raw({ state }), type, done, NOW)
  it("running tasks can only be canceled", () => {
    expect(availableActions(t("copy", 1, false))).toEqual(["cancel"])
  })
  it("done tasks can be deleted; failed ones retried", () => {
    expect(availableActions(t("copy", 2, true))).toEqual(["delete"])
    expect(availableActions(t("copy", 7, true))).toEqual(["retry", "delete"])
  })
  it("upload has no retry", () => {
    expect(availableActions(t("upload", 7, true))).toEqual(["delete"])
    expect(bulkActions("upload")).not.toContain("retry_failed")
    expect(bulkActions("copy")).toContain("retry_failed")
  })
})

const snap = (over: Partial<SyncSnapshot> = {}): SyncSnapshot => ({
  id: "s1",
  spec: {
    mode: "copy",
    src: "local:/tmp/a",
    dst: "/local",
    dry_run: false,
    size_only: false,
    track_renames: false,
    resync: false,
    force: false,
    filters: [],
    transfers: 4,
    checkers: 8,
  },
  state: "running",
  started_at: "2026-10-08T09:00:00Z",
  counters: {
    match: 0,
    differ: 0,
    only_in_src: 0,
    only_in_dst: 0,
    errors: 0,
    uploaded: 0,
    uploaded_bytes: 0,
    rapid_uploads: 0,
    rapid_bytes: 0,
  },
  stats: {
    bytes: 50,
    totalBytes: 200,
    transfers: 1,
    totalTransfers: 3,
    speed: 10,
    eta: 15,
  },
  ...over,
})

describe("sync mapping", () => {
  it("maps type and state", () => {
    for (const s of ["running", "succeeded", "failed", "canceled"] as const) {
      const t = mapSyncSnapshot(snap({ state: s }), NOW)
      expect(t.state).toBe(s)
      expect(t.type).toBe("sync.copy")
    }
  })
  it("does not compute percent while running", () => {
    const t = mapSyncSnapshot(snap(), NOW)
    expect(t.progress.percent).toBeUndefined()
    expect(t.progress).toMatchObject({
      bytesDone: 50,
      bytesTotal: 200,
      itemsDone: 1,
      itemsTotal: 3,
      speedBytesPerSecond: 10,
      etaMs: 15000,
    })
  })
  it("computes percent once finished", () => {
    const t = mapSyncSnapshot(
      snap({ state: "failed", ended_at: "2026-10-08T09:05:00Z" }),
      NOW,
    )
    expect(t.progress.percent).toBe(25)
    expect(t.endedAt).toBe("2026-10-08T09:05:00Z")
  })
  it("a succeeded job without stats is 100%", () => {
    const t = mapSyncSnapshot(
      snap({ state: "succeeded", stats: undefined }),
      NOW,
    )
    expect(t.progress.percent).toBe(100)
  })
  it("ignores a Go zero ended_at", () => {
    const t = mapSyncSnapshot(snap({ ended_at: "0001-01-01T00:00:00Z" }), NOW)
    expect(t.endedAt).toBeUndefined()
  })
  it("null eta stays unknown", () => {
    const t = mapSyncSnapshot(snap({ stats: { eta: null } }), NOW)
    expect(t.progress.etaMs).toBeUndefined()
  })
  it("only running jobs can be canceled", () => {
    expect(availableActions(mapSyncSnapshot(snap(), NOW))).toEqual(["cancel"])
    expect(
      availableActions(mapSyncSnapshot(snap({ state: "succeeded" }), NOW)),
    ).toEqual([])
  })
})

describe("sections and filters", () => {
  it.each([
    ["queued", "active"],
    ["running", "active"],
    ["waiting_retry", "active"],
    ["canceling", "active"],
    ["failed", "failed"],
    ["succeeded", "done"],
    ["canceled", "done"],
  ] as const)("%s -> %s", (s, sec) => {
    expect(sectionOf(s)).toBe(sec)
  })
  it.each([
    ["file.upload", "upload"],
    ["offline.transfer", "offline"],
    ["archive.upload", "decompress"],
    ["sync.bisync", "sync"],
  ])("%s -> chip %s", (type, key) => {
    expect(filterKeyOf(type)).toBe(key)
  })
  it.each([
    [undefined, "all"],
    ["offline_download", "offline"],
    ["offline_download_transfer", "offline"],
    ["decompress_upload", "decompress"],
    ["copy", "copy"],
    ["bogus", "all"],
  ])("legacy route %s -> %s", (t, key) => {
    expect(legacyTypeToFilter(t)).toBe(key)
  })
})

describe("drawerTasks", () => {
  const now = NOW.getTime()
  const mk = (i: number, state: number, end: string | null) =>
    mapTache(
      raw({
        id: `x${i}`,
        state,
        end_time: end,
        start_time: new Date(now - i * 1000).toISOString(),
      }),
      "copy",
      state !== 1,
      NOW,
    )
  const recent = new Date(now - 60_000).toISOString()
  const old = new Date(now - 11 * 60_000).toISOString()

  it("keeps active and recently ended, drops old ones", () => {
    const list = [mk(1, 1, null), mk(2, 2, recent), mk(3, 2, old)]
    expect(
      drawerTasks(list, now)
        .map((t) => t.correlationId)
        .sort(),
    ).toEqual(["x1", "x2"])
  })
  it("caps at ten", () => {
    const list = Array.from({ length: 12 }, (_, i) => mk(i, 1, null))
    expect(drawerTasks(list, now)).toHaveLength(10)
  })
})

describe("sync phase", () => {
  const checkingStats = {
    checks: 3133,
    totalChecks: 3133,
    listed: 7290,
    transfers: 0,
    totalTransfers: 0,
    bytes: 0,
    totalBytes: 0,
  }
  it("is checking while comparisons exist and nothing is queued", () => {
    expect(syncPhase(checkingStats)).toBe("checking")
    const t = mapSyncSnapshot(
      snap({
        stats: checkingStats,
        counters: { ...snap().counters, match: 3640 },
      }),
      NOW,
    )
    expect(t.phase).toBe("checking")
    expect(t.progress.checksDone).toBe(3133)
    expect(t.progress.checksTotal).toBe(3133)
    expect(t.progress.scanned).toBe(7290)
    expect(t.progress.percent).toBeUndefined()
  })
  it("is transferring once something is queued or moving", () => {
    expect(syncPhase({ ...checkingStats, totalTransfers: 2 })).toBe(
      "transferring",
    )
    expect(
      syncPhase({ ...checkingStats, transfers: 1, totalTransfers: 1 }),
    ).toBe("transferring")
    expect(mapSyncSnapshot(snap(), NOW).phase).toBe("transferring")
  })
  it("with no stats or no checks it is not checking", () => {
    expect(syncPhase(undefined)).toBe("transferring")
    expect(syncPhase({})).toBe("transferring")
    expect(syncPhase({ checks: 0, transfers: 0, totalTransfers: 0 })).toBe(
      "transferring",
    )
  })
  it("a finished job reports its state as phase", () => {
    expect(
      mapSyncSnapshot(snap({ state: "succeeded", stats: checkingStats }), NOW)
        .phase,
    ).toBe("succeeded")
  })
})
