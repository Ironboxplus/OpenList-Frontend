import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { TacheRaw } from "../adapter"
import { createTransfersStore, DONE_EVERY, FAST_MS, SLOW_MS } from "../store"
import type { StoreDeps } from "../store"

const rawTask = (over: Partial<TacheRaw> = {}): TacheRaw => ({
  id: "1",
  name: "copy [/a](/x) to [/b](/)",
  creator: "u",
  creator_role: 0,
  state: 1,
  status: "",
  progress: 10,
  start_time: "2026-10-08T09:59:00Z",
  end_time: null,
  total_bytes: 0,
  error: "",
  ...over,
})

const ok = <T>(data: T) => Promise.resolve({ code: 200, message: "ok", data })

interface Harness {
  deps: StoreDeps
  hidden: { v: boolean }
  undoneCalls: () => number
  doneCalls: () => number
  mem: Map<string, string>
}

const harness = (over: Partial<StoreDeps> = {}, undone: TacheRaw[] = []) => {
  const hidden = { v: false }
  const mem = new Map<string, string>()
  const fetchTache = vi.fn((type: string, done: boolean) =>
    ok(type === "copy" && !done ? undone : []),
  )
  const deps: StoreDeps = {
    fetchTache: fetchTache as any,
    postTache: vi.fn(() => ok(null)) as any,
    fetchSyncList: vi.fn(() => ok([])) as any,
    fetchSyncHistory: vi.fn(() => ok([])) as any,
    fetchSyncJob: vi.fn(() => ok(null)) as any,
    cancelSync: vi.fn(() => ok(null)) as any,
    isAdmin: () => false,
    isHidden: () => hidden.v,
    notifyError: vi.fn(),
    info: vi.fn(),
    now: () => new Date("2026-10-08T10:00:00Z"),
    storage: {
      getItem: (k) => mem.get(k) ?? null,
      setItem: (k, v) => void mem.set(k, v),
    },
    ...over,
  }
  const calls = (done: boolean) =>
    fetchTache.mock.calls.filter(([type, d]) => type === "copy" && d === done)
      .length
  return {
    deps,
    hidden,
    mem,
    undoneCalls: () => calls(false),
    doneCalls: () => calls(true),
  } satisfies Harness
}

// flush microtasks so awaited fetches settle without advancing timers
const settle = () => vi.advanceTimersByTimeAsync(0)

describe("polling cadence", () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it("polls every 15s when nothing is watching", async () => {
    const h = harness({}, [rawTask()])
    const s = createTransfersStore(h.deps)
    s.start()
    await settle()
    expect(h.undoneCalls()).toBe(1)
    await vi.advanceTimersByTimeAsync(SLOW_MS - 1)
    expect(h.undoneCalls()).toBe(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(h.undoneCalls()).toBe(2)
    s.stop()
    s.dispose()
  })

  it("polls every 2s while a view is open and a task is active", async () => {
    const h = harness({}, [rawTask()])
    const s = createTransfersStore(h.deps)
    s.start()
    await settle()
    const release = s.watch()
    expect(s.activeCount()).toBe(1)
    const before = h.undoneCalls()
    await vi.advanceTimersByTimeAsync(FAST_MS * 3)
    expect(h.undoneCalls()).toBe(before + 3)
    release()
    const after = h.undoneCalls()
    await vi.advanceTimersByTimeAsync(FAST_MS * 3)
    expect(h.undoneCalls()).toBe(after)
    await vi.advanceTimersByTimeAsync(SLOW_MS)
    expect(h.undoneCalls()).toBe(after + 1)
    s.stop()
    s.dispose()
  })

  it("stays slow with a view open but no active task", async () => {
    const h = harness({}, [rawTask({ state: 2 })])
    const s = createTransfersStore(h.deps)
    s.start()
    await settle()
    s.watch()
    const before = h.undoneCalls()
    await vi.advanceTimersByTimeAsync(SLOW_MS - 1)
    expect(h.undoneCalls()).toBe(before)
    await vi.advanceTimersByTimeAsync(1)
    expect(h.undoneCalls()).toBe(before + 1)
    s.stop()
    s.dispose()
  })

  it("keeps exactly one timer", async () => {
    const h = harness({}, [rawTask()])
    const s = createTransfersStore(h.deps)
    s.start()
    s.start()
    await settle()
    s.watch()
    s.watch()
    void s.refresh()
    void s.refresh()
    await settle()
    expect(vi.getTimerCount()).toBe(1)
    s.stop()
    expect(vi.getTimerCount()).toBe(0)
    s.dispose()
  })

  it("pauses while the page is hidden and refreshes on return", async () => {
    const h = harness({}, [rawTask()])
    const s = createTransfersStore(h.deps)
    s.start()
    await settle()
    const n = h.undoneCalls()
    h.hidden.v = true
    document.dispatchEvent(new Event("visibilitychange"))
    await vi.advanceTimersByTimeAsync(SLOW_MS * 3)
    expect(h.undoneCalls()).toBe(n)
    expect(vi.getTimerCount()).toBe(0)
    h.hidden.v = false
    document.dispatchEvent(new Event("visibilitychange"))
    await settle()
    expect(h.undoneCalls()).toBe(n + 1)
    expect(vi.getTimerCount()).toBe(1)
    s.stop()
    s.dispose()
  })

  it("fetches the done list once per DONE_EVERY undone fetches", async () => {
    const h = harness({}, [rawTask()])
    const s = createTransfersStore(h.deps)
    s.start()
    await settle()
    s.watch()
    for (let i = 0; i < DONE_EVERY * 2 - 1; i++) {
      await vi.advanceTimersByTimeAsync(FAST_MS)
    }
    expect(h.undoneCalls()).toBe(DONE_EVERY * 2)
    expect(h.doneCalls()).toBe(2)
    s.stop()
    s.dispose()
  })

  it("fetches done immediately when a task leaves the undone list", async () => {
    let list = [rawTask()]
    const h = harness({})
    ;(h.deps.fetchTache as any) = vi.fn((type: string, done: boolean) =>
      ok(type === "copy" && !done ? list : []),
    )
    const s = createTransfersStore(h.deps)
    s.start()
    await settle()
    const doneBefore = (h.deps.fetchTache as any).mock.calls.filter(
      ([t, d]: any) => t === "copy" && d,
    ).length
    list = []
    await vi.advanceTimersByTimeAsync(SLOW_MS)
    const doneAfter = (h.deps.fetchTache as any).mock.calls.filter(
      ([t, d]: any) => t === "copy" && d,
    ).length
    expect(doneAfter).toBe(doneBefore + 1)
    s.stop()
    s.dispose()
  })
})

describe("sync capability", () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it.each([404, 405])("turns off on %i and stops asking", async (code) => {
    const fetchSyncList = vi.fn(() =>
      Promise.resolve({ code, message: "nope", data: null }),
    )
    const h = harness({
      isAdmin: () => true,
      fetchSyncList: fetchSyncList as any,
    })
    const s = createTransfersStore(h.deps)
    await s.refresh()
    expect(s.syncCapability()).toBe("no")
    expect(s.syncAvailable()).toBe(false)
    await s.refresh()
    await s.refresh()
    expect(fetchSyncList).toHaveBeenCalledTimes(1)
    expect(h.deps.info).toHaveBeenCalledTimes(1)
    s.dispose()
  })

  it("turns on after a 200 and surfaces sync jobs", async () => {
    const snap = {
      id: "s1",
      spec: { mode: "copy", src: "a", dst: "/b" },
      state: "running",
      started_at: "2026-10-08T09:00:00Z",
      counters: {},
    }
    const h = harness({
      isAdmin: () => true,
      fetchSyncList: vi.fn(() => ok([snap])) as any,
    })
    const s = createTransfersStore(h.deps)
    await s.refresh()
    expect(s.syncAvailable()).toBe(true)
    expect(s.tasks().map((t) => t.id)).toEqual(["sync:s1"])
    s.dispose()
  })

  it("never asks a non-admin", async () => {
    const h = harness({})
    const s = createTransfersStore(h.deps)
    await s.refresh()
    expect(h.deps.fetchSyncList).not.toHaveBeenCalled()
    s.dispose()
  })
})

describe("sync history", () => {
  const snap = (state: string) => ({
    id: "s1",
    spec: { mode: "copy", src: "a", dst: "/b" },
    state,
    started_at: "2026-10-08T09:00:00Z",
    counters: {},
  })

  it("reloads history when a running sync job leaves the list", async () => {
    let running = [snap("running")]
    const h = harness({
      isAdmin: () => true,
      fetchSyncList: vi.fn(() => ok(running)) as any,
      fetchSyncHistory: vi.fn(() => ok([snap("succeeded")])) as any,
    })
    const s = createTransfersStore(h.deps)
    await s.refresh()
    expect(h.deps.fetchSyncHistory).not.toHaveBeenCalled()
    running = []
    await s.refresh()
    await Promise.resolve()
    await Promise.resolve()
    expect(h.deps.fetchSyncHistory).toHaveBeenCalledTimes(1)
    expect(s.history().map((t) => t.id)).toEqual(["sync:s1"])
    s.dispose()
  })

  it("does not load history for a non-admin", async () => {
    const h = harness({})
    const s = createTransfersStore(h.deps)
    await s.loadHistory()
    expect(h.deps.fetchSyncHistory).not.toHaveBeenCalled()
    s.dispose()
  })
})

describe("act", () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it("posts to the legacy endpoint and refreshes", async () => {
    const h = harness({}, [rawTask({ id: "42" })])
    const s = createTransfersStore(h.deps)
    await s.refresh()
    const n = h.undoneCalls()
    expect(await s.act("copy:42", "cancel")).toBe(true)
    expect(h.deps.postTache).toHaveBeenCalledWith("copy", "cancel", "42")
    expect(h.undoneCalls()).toBe(n + 1)
    s.dispose()
  })

  it("reports an API error instead of swallowing it", async () => {
    const h = harness(
      {
        postTache: vi.fn(() =>
          Promise.resolve({ code: 500, message: "no permission", data: null }),
        ) as any,
      },
      [rawTask({ id: "42" })],
    )
    const s = createTransfersStore(h.deps)
    await s.refresh()
    expect(await s.act("copy:42", "cancel")).toBe(false)
    expect(h.deps.notifyError).toHaveBeenCalledWith("no permission")
    s.dispose()
  })

  it("reports a thrown request error", async () => {
    const h = harness(
      { postTache: vi.fn(() => Promise.reject(new Error("net down"))) as any },
      [rawTask({ id: "42" })],
    )
    const s = createTransfersStore(h.deps)
    await s.refresh()
    expect(await s.act("copy:42", "cancel")).toBe(false)
    expect(h.deps.notifyError).toHaveBeenCalledWith("net down")
    s.dispose()
  })

  it("cancels sync jobs through the sync endpoint", async () => {
    const snap = {
      id: "s1",
      spec: { mode: "copy", src: "a", dst: "/b" },
      state: "running",
      started_at: "2026-10-08T09:00:00Z",
      counters: {},
    }
    const h = harness({
      isAdmin: () => true,
      fetchSyncList: vi.fn(() => ok([snap])) as any,
    })
    const s = createTransfersStore(h.deps)
    await s.refresh()
    await s.act("sync:s1", "cancel")
    expect(h.deps.cancelSync).toHaveBeenCalledWith("s1")
    s.dispose()
  })

  it("bulk actions hit every type of the chip and report failures", async () => {
    const postTache = vi.fn((type: string) =>
      Promise.resolve(
        type === "move"
          ? { code: 500, message: "bad", data: null }
          : { code: 200, message: "ok", data: null },
      ),
    )
    const h = harness({ postTache: postTache as any })
    const s = createTransfersStore(h.deps)
    expect(await s.actBulk("all", "clear_done")).toBe(false)
    expect(postTache).toHaveBeenCalledTimes(7)
    expect(h.deps.notifyError).toHaveBeenCalledWith("bad")
    s.dispose()
  })
})

describe("failed-unseen count", () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it("counts failed tasks until they are marked seen, and persists that", async () => {
    const h = harness({}, [rawTask({ id: "9", state: 7, error: "x" })])
    ;(h.deps.fetchTache as any) = vi.fn((type: string, done: boolean) =>
      ok(
        type === "copy" && done
          ? [rawTask({ id: "9", state: 7, error: "x" })]
          : [],
      ),
    )
    const s = createTransfersStore(h.deps)
    await s.refresh()
    expect(s.failedUnseenCount()).toBe(1)
    s.markFailedSeen()
    expect(s.failedUnseenCount()).toBe(0)
    s.dispose()
    const s2 = createTransfersStore(h.deps)
    await s2.refresh()
    expect(s2.failedUnseenCount()).toBe(0)
    s2.dispose()
  })
})

describe("completion reporting", () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  // A mutable copy list: tasks move from undone to done as a test advances.
  const world = (initial: { undone: TacheRaw[]; done: TacheRaw[] }) => {
    const lists = { ...initial }
    const succeeded = vi.fn()
    const h = harness({
      fetchTache: ((type: string, done: boolean) =>
        ok(type === "copy" ? (done ? lists.done : lists.undone) : [])) as any,
      onSucceeded: succeeded,
    })
    return { lists, succeeded, deps: h.deps }
  }

  const finished = (id: string) =>
    rawTask({ id, state: 2, end_time: "2026-10-08T09:59:50Z" })

  it("reports a running task once when it succeeds", async () => {
    const w = world({ undone: [rawTask({ id: "a" })], done: [] })
    const s = createTransfersStore(w.deps)
    s.start()
    await settle()
    expect(w.succeeded).not.toHaveBeenCalled()
    w.lists.undone = []
    w.lists.done = [finished("a")]
    await s.refresh({ full: true })
    expect(w.succeeded).toHaveBeenCalledTimes(1)
    expect(w.succeeded.mock.calls[0][0].id).toBe("copy:a")
    await s.refresh({ full: true })
    await s.refresh({ full: true })
    expect(w.succeeded).toHaveBeenCalledTimes(1)
    s.stop()
    s.dispose()
  })

  it("does not report tasks that were already finished at the first load", async () => {
    const w = world({ undone: [], done: [finished("old")] })
    const s = createTransfersStore(w.deps)
    s.start()
    await settle()
    await s.refresh({ full: true })
    expect(w.succeeded).not.toHaveBeenCalled()
    s.stop()
    s.dispose()
  })

  it("reports a task that finished between two polls (never seen running)", async () => {
    const w = world({ undone: [], done: [] })
    const s = createTransfersStore(w.deps)
    s.start()
    await settle()
    w.lists.done = [finished("quick")]
    await s.refresh({ full: true })
    expect(w.succeeded).toHaveBeenCalledTimes(1)
    s.stop()
    s.dispose()
  })

  it("ignores failures and long-finished history surfacing late", async () => {
    const w = world({ undone: [rawTask({ id: "f" })], done: [] })
    const s = createTransfersStore(w.deps)
    s.start()
    await settle()
    w.lists.undone = []
    w.lists.done = [
      rawTask({ id: "f", state: 7, end_time: "2026-10-08T09:59:50Z" }),
      rawTask({ id: "ancient", state: 2, end_time: "2026-10-01T00:00:00Z" }),
    ]
    await s.refresh({ full: true })
    expect(w.succeeded).not.toHaveBeenCalled()
    s.stop()
    s.dispose()
  })
})
