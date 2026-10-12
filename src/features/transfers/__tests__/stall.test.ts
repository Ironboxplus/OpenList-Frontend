import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { TacheRaw } from "../adapter"
import { STALE_MS } from "../stall"
import { createTransfersStore } from "../store"
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
const T0 = Date.parse("2026-10-08T10:00:00Z")

// A store on a clock the test moves; each `poll` is one full refresh.
const setup = () => {
  const clock = { ms: T0 }
  const hidden = { v: false }
  const list = { v: [rawTask()] }
  const deps: StoreDeps = {
    fetchTache: ((type: string, done: boolean) =>
      ok(type === "copy" && !done ? list.v : [])) as any,
    postTache: vi.fn(() => ok(null)) as any,
    fetchSyncList: vi.fn(() => ok([])) as any,
    fetchSyncHistory: vi.fn(() => ok([])) as any,
    fetchSyncJob: vi.fn(() => ok(null)) as any,
    cancelSync: vi.fn(() => ok(null)) as any,
    isAdmin: () => false,
    isHidden: () => hidden.v,
    notifyError: vi.fn(),
    info: vi.fn(),
    now: () => new Date(clock.ms),
    storage: { getItem: () => null, setItem: () => {} },
  }
  const store = createTransfersStore(deps)
  const poll = async (advanceMs = 0) => {
    clock.ms += advanceMs
    await store.refresh({ full: false })
  }
  return { store, clock, hidden, list, poll }
}

describe("stalled progress", () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it("marks a task only once its progress was still for more than a minute", async () => {
    const { store, poll } = setup()
    await poll()
    expect(store.tasks()[0].stale).toBe(false)
    await poll(STALE_MS - 1000)
    expect(store.tasks()[0].stale).toBe(false)
    await poll(2000)
    expect(store.tasks()[0].stale).toBe(true)
    store.dispose()
  })

  it("reports when the numbers last moved as the progress time", async () => {
    const { store, poll, list } = setup()
    await poll()
    list.v = [rawTask({ progress: 11 })]
    await poll(30_000)
    await poll(20_000)
    expect(store.tasks()[0].progress.updatedAt).toBe(
      new Date(T0 + 30_000).toISOString(),
    )
    store.dispose()
  })

  it("clears the mark the moment the fingerprint changes", async () => {
    const { store, poll, list } = setup()
    await poll()
    await poll(STALE_MS + 1000)
    expect(store.tasks()[0].stale).toBe(true)
    list.v = [rawTask({ progress: 11 })]
    await poll(1000)
    expect(store.tasks()[0].stale).toBe(false)
    store.dispose()
  })

  it("does not count time while the page was hidden", async () => {
    const { store, poll, hidden, clock } = setup()
    store.start()
    await vi.advanceTimersByTimeAsync(0)
    await poll(30_000)
    hidden.v = true
    document.dispatchEvent(new Event("visibilitychange"))
    clock.ms += 10 * 60_000
    hidden.v = false
    document.dispatchEvent(new Event("visibilitychange"))
    await vi.advanceTimersByTimeAsync(0)
    expect(store.tasks()[0].stale).toBe(false)
    // 30s before hiding + 31s visible afterwards is more than a minute
    await poll(31_000)
    expect(store.tasks()[0].stale).toBe(true)
    store.stop()
    store.dispose()
  })

  it("never marks a task that reports no progress numbers", async () => {
    const { store, poll, list } = setup()
    list.v = [rawTask({ progress: 100 })] // running at 100 means unknown
    await poll()
    await poll(10 * STALE_MS)
    expect(store.tasks()[0].stale).toBeUndefined()
    store.dispose()
  })

  it("only watches running tasks", async () => {
    const { store, poll, list } = setup()
    await poll()
    list.v = [rawTask({ state: 6, error: "x" })]
    await poll(10 * STALE_MS)
    expect(store.tasks()[0].stale).toBeUndefined()
    store.dispose()
  })
})
