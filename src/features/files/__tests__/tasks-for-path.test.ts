import { describe, expect, it } from "vitest"
import type { UnifiedTask } from "~/platform/contracts/task"
import {
  averagePercent,
  filesLinkFor,
  groupByType,
  isUnder,
  openTarget,
  taskSetKey,
  tasksForPath,
  transferLinkFor,
} from "../tasks-for-path"

const task = (over: Partial<UnifiedTask> & { id: string }): UnifiedTask =>
  ({
    type: "copy",
    state: "running",
    phase: "",
    attempt: 1,
    maxAttempts: 1,
    retryable: false,
    progress: { updatedAt: "2026-10-08T10:00:00Z" },
    createdAt: "",
    updatedAt: "",
    version: 1,
    correlationId: over.id,
    legacy: {
      kind: "tache",
      tacheType: "copy",
      rawState: 1,
      name: "",
      done: false,
    },
    ...over,
  }) as UnifiedTask

describe("isUnder", () => {
  it("is segment-aware", () => {
    expect(isUnder("/a/b", "/a")).toBe(true)
    expect(isUnder("/a", "/a")).toBe(true)
    expect(isUnder("/ab", "/a")).toBe(false)
    expect(isUnder("/a/b", "/")).toBe(true)
    expect(isUnder("/a/b/", "/a/b")).toBe(true)
  })
})

describe("tasksForPath", () => {
  const up = task({ id: "up", destination: { path: "/media/inbox" } })
  const sub = task({ id: "sub", destination: { path: "/media/inbox/x" } })
  const other = task({ id: "other", destination: { path: "/elsewhere" } })
  const failed = task({
    id: "bad",
    state: "failed",
    destination: { path: "/media" },
  })
  const done = task({
    id: "ok",
    state: "succeeded",
    destination: { path: "/media" },
  })
  const fromHere = task({
    id: "from",
    source: { path: "/media/inbox/a.mkv" },
    destination: { path: "/backup" },
  })

  it("groups active and failed tasks whose destination is here or below", () => {
    const r = tasksForPath([up, sub, other, failed, done], "/media")
    expect(r.active.map((t) => t.id)).toEqual(["up", "sub"])
    expect(r.failed.map((t) => t.id)).toEqual(["bad"])
  })

  it("a folder deeper than the destination does not match", () => {
    expect(tasksForPath([up], "/media/inbox/deeper")).toEqual({
      active: [],
      failed: [],
    })
  })

  it("counts tasks whose source is in this folder too", () => {
    expect(tasksForPath([fromHere], "/media").active).toHaveLength(1)
  })

  it("ignores finished tasks and sync local: endpoints", () => {
    const sync = task({
      id: "s",
      type: "sync.copy",
      source: { path: "local:/data" },
      destination: { path: "/media" },
    })
    expect(
      tasksForPath([done, sync], "/media").active.map((t) => t.id),
    ).toEqual(["s"])
    expect(tasksForPath([sync], "/data").active).toHaveLength(0)
  })

  it("the root sees everything with a tree path", () => {
    expect(tasksForPath([up, other], "/").active).toHaveLength(2)
  })
})

describe("taskSetKey / averagePercent", () => {
  it("changes when a task appears or changes state, not with order", () => {
    const a = task({ id: "a" })
    const b = task({ id: "b" })
    expect(taskSetKey([a, b])).toBe(taskSetKey([b, a]))
    expect(taskSetKey([a])).not.toBe(taskSetKey([a, b]))
    expect(taskSetKey([a])).not.toBe(taskSetKey([{ ...a, state: "failed" }]))
  })
  it("averages known percentages only", () => {
    const p = (percent?: number) =>
      task({ id: String(percent), progress: { updatedAt: "", percent } })
    expect(averagePercent([p(20), p(60), p(undefined)])).toBe(40)
    expect(averagePercent([p(undefined)])).toBeUndefined()
  })
})

describe("openTarget", () => {
  const copy = task({
    id: "c",
    source: { path: "/in/dir/film.mkv" },
    destination: { path: "/out" },
  })
  it("source opens the containing folder and highlights the file", () => {
    expect(openTarget(copy, "source")).toEqual({
      dir: "/in/dir",
      highlight: "film.mkv",
    })
  })
  it("destination opens the folder and highlights the same file name", () => {
    expect(openTarget(copy, "destination")).toEqual({
      dir: "/out",
      highlight: "film.mkv",
    })
  })
  it("a sync job: no button for local:, plain folder for the tree side", () => {
    const sync = task({
      id: "s",
      type: "sync.copy",
      source: { path: "local:/data" },
      destination: { path: "/a/big" },
    })
    expect(openTarget(sync, "source")).toBeUndefined()
    expect(openTarget(sync, "destination")).toEqual({ dir: "/a/big" })
  })
  it("a file at the root has the root as its folder", () => {
    const t = task({ id: "r", source: { path: "/x.txt" } })
    expect(openTarget(t, "source")).toEqual({ dir: "/", highlight: "x.txt" })
  })
  it("nothing without a path", () => {
    expect(openTarget(task({ id: "n" }), "destination")).toBeUndefined()
  })
})

describe("transferLinkFor", () => {
  it("one task opens it, several filter by path", () => {
    expect(transferLinkFor([task({ id: "a b" })], "/m")).toBe(
      "/@transfers?task=a%20b",
    )
    expect(
      transferLinkFor([task({ id: "1" }), task({ id: "2" })], "/m x"),
    ).toBe("/@transfers?path=%2Fm%20x")
  })
})

describe("groupByType", () => {
  it("counts per type in first-seen order", () => {
    const g = groupByType([
      task({ id: "1", type: "file.copy" }),
      task({ id: "2", type: "file.upload" }),
      task({ id: "3", type: "file.copy" }),
    ])
    expect(g).toEqual([
      { type: "file.copy", count: 2 },
      { type: "file.upload", count: 1 },
    ])
    expect(groupByType([])).toEqual([])
  })
})

describe("filesLinkFor", () => {
  it("encodes each segment and adds the highlight", () => {
    expect(filesLinkFor({ dir: "/a b/中文", highlight: "x y.mkv" })).toBe(
      "/a%20b/%E4%B8%AD%E6%96%87?highlight=x%20y.mkv",
    )
    expect(filesLinkFor({ dir: "/" })).toBe("/")
    expect(filesLinkFor({ dir: "/m" })).toBe("/m")
  })
})
