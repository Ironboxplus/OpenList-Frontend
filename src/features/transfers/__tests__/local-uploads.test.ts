import { describe, expect, it, vi } from "vitest"
import { mapLocalUpload, availableActions } from "../adapter"
import { createLocalUploads } from "../local-uploads"
import { createTransfersStore } from "../store"
import type { StoreDeps } from "../store"

const ok = <T>(data: T) => Promise.resolve({ code: 200, message: "ok", data })

const file = (over = {}) => ({
  name: "a.bin",
  path: "dir/a.bin",
  size: 1000,
  progress: 0,
  speed: 0,
  status: "pending" as const,
  ...over,
})

const setup = () => {
  let t = Date.parse("2026-10-08T10:00:00Z")
  const source = createLocalUploads(() => t)
  const deps: StoreDeps = {
    fetchTache: (() => ok([])) as any,
    postTache: vi.fn(() => ok(null)) as any,
    fetchSyncList: vi.fn(() => ok([])) as any,
    fetchSyncHistory: vi.fn(() => ok([])) as any,
    fetchSyncJob: vi.fn(() => ok(null)) as any,
    cancelSync: vi.fn(() => ok(null)) as any,
    isAdmin: () => false,
    isHidden: () => false,
    notifyError: vi.fn(),
    info: vi.fn(),
    now: () => new Date(t),
    storage: { getItem: () => null, setItem: () => {} },
    localUploads: source,
  }
  const store = createTransfersStore(deps)
  return { source, store, tick: (ms: number) => (t += ms) }
}

describe("in-browser uploads in the task list", () => {
  it("shows an upload from the first moment and follows its status", () => {
    const { source, store } = setup()
    const id = source.add(file(), "/in/dir/a.bin")
    let task = store.tasks().find((x) => x.legacy.kind === "upload_local")!
    expect(task.state).toBe("queued")
    expect(task.type).toBe("file.upload")
    expect(task.destination?.path).toBe("/in/dir/a.bin")

    source.update(id, "status", "uploading")
    source.update(id, "progress", 40)
    source.update(id, "speed", 250)
    task = store.tasks()[0]
    expect(task.state).toBe("running")
    expect(task.progress.percent).toBe(40)
    expect(task.progress.bytesDone).toBe(400)
    expect(task.progress.speedBytesPerSecond).toBe(250)
    expect(store.activeCount()).toBe(1)

    source.update(id, "status", "success")
    expect(store.tasks()[0].state).toBe("succeeded")
    expect(store.tasks()[0].endedAt).toBeDefined()
    store.dispose()
  })

  it("is the same record, under the same id, as the panel's", () => {
    const { source, store } = setup()
    const id = source.add(file(), "/x")
    expect(source.list()[0].id).toBe(id)
    const task = store.tasks()[0]
    expect(task.id).toBe(`upload_local:${id}`)
    expect(task.legacy).toEqual({ kind: "upload_local", id })
    // a second file is a second record, even with the same relative path
    const other = source.add(file(), "/y")
    expect(other).not.toBe(id)
    expect(store.tasks()).toHaveLength(2)
    store.dispose()
  })

  it("maps a failed upload with its message, retry only when it can restart", () => {
    const { source, store } = setup()
    const restart = vi.fn()
    const withRetry = source.add(file(), "/a", restart)
    const without = source.add(file({ path: "b" }), "/b")
    for (const id of [withRetry, without]) {
      source.update(id, "status", "error")
      source.update(id, "msg", "boom")
    }
    const byId = (id: string) =>
      store.tasks().find((x) => x.correlationId === id)!
    expect(byId(withRetry).error?.message).toBe("boom")
    expect(availableActions(byId(withRetry))).toEqual(["retry", "delete"])
    expect(availableActions(byId(without))).toEqual(["delete"])
    store.dispose()
  })

  it("offers no action while the upload runs", () => {
    const { source } = setup()
    const id = source.add(file({ status: "uploading" }), "/a")
    expect(availableActions(mapLocalUpload(source.list()[0]))).toEqual([])
    expect(id).toBeTruthy()
  })

  it("retry restarts the upload from zero; delete drops the record", async () => {
    const { source, store } = setup()
    const restart = vi.fn()
    const id = source.add(file(), "/a", restart)
    source.update(id, "status", "error")
    source.update(id, "msg", "boom")
    source.update(id, "progress", 70)
    const tid = `upload_local:${id}`

    expect(await store.act(tid, "retry")).toBe(true)
    expect(restart).toHaveBeenCalledWith(id)
    expect(source.list()[0]).toMatchObject({ msg: "", progress: 0 })
    expect(await store.act(tid, "cancel")).toBe(false)

    expect(await store.act(tid, "delete")).toBe(true)
    expect(store.tasks()).toHaveLength(0)
    store.dispose()
  })

  it("bulk clear removes finished uploads, keeps running ones", async () => {
    const { source, store } = setup()
    const done = source.add(file(), "/a")
    const failed = source.add(file(), "/b")
    const running = source.add(file(), "/c")
    source.update(done, "status", "success")
    source.update(failed, "status", "error")
    source.update(running, "status", "uploading")

    await store.actBulk("upload", "clear_succeeded")
    expect(source.list().map((u) => u.id)).toEqual([failed, running])
    await store.actBulk("all", "clear_done")
    expect(source.list().map((u) => u.id)).toEqual([running])
    store.dispose()
  })
})
