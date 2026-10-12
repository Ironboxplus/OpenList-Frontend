import { createRoot, createSignal, createMemo } from "solid-js"
import { describe, expect, it, vi } from "vitest"
import type { StoreDeps } from "~/features/transfers/store"
import { createTransfersStore } from "~/features/transfers/store"
import { createLocalUploads } from "~/features/transfers/local-uploads"
import { bindTransfersToUser } from "../transfers-lifecycle"

const ok = <T>(data: T) => Promise.resolve({ code: 200, message: "ok", data })

// The shell's wiring: me() -> a boolean memo -> an id memo -> the effect.
const shellWith = (store: Parameters<typeof bindTransfersToUser>[1]) => {
  const [me, setMe] = createSignal<{ id?: number; guest?: boolean }>({})
  let dispose = () => {}
  createRoot((d) => {
    dispose = d
    const shown = createMemo(() => me().id !== undefined && !me().guest)
    const userId = createMemo(() => (shown() ? me().id : undefined))
    bindTransfersToUser(userId, store)
  })
  return { setMe, dispose }
}

describe("transfers lifecycle", () => {
  it("replacing me() with an equal user does not stop, restart or reset", () => {
    const stop = vi.fn()
    const store = { start: vi.fn(() => stop), reset: vi.fn() }
    const { setMe, dispose } = shellWith(store)
    setMe({ id: 1 })
    expect(store.start).toHaveBeenCalledTimes(1)
    setMe({ id: 1 })
    setMe({ id: 1 })
    expect(store.start).toHaveBeenCalledTimes(1)
    expect(stop).not.toHaveBeenCalled()
    expect(store.reset).not.toHaveBeenCalled()
    dispose()
  })

  it("signing out (guest or empty me) resets; another user restarts", () => {
    const stop = vi.fn()
    const store = { start: vi.fn(() => stop), reset: vi.fn() }
    const { setMe, dispose } = shellWith(store)
    setMe({ id: 1 })
    setMe({ id: 2, guest: true })
    expect(stop).toHaveBeenCalledTimes(1)
    expect(store.reset).toHaveBeenCalledTimes(1)
    setMe({ id: 3 })
    setMe({ id: 4 })
    expect(store.start).toHaveBeenCalledTimes(3)
    expect(store.reset).toHaveBeenCalledTimes(2)
    setMe({})
    expect(store.reset).toHaveBeenCalledTimes(3)
    dispose()
  })

  it("reset on the real store clears finished local uploads and the stall tracker", async () => {
    const t = Date.parse("2026-10-08T10:00:00Z")
    let clock = t
    const local = createLocalUploads(() => clock)
    const raw = {
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
    }
    const deps: StoreDeps = {
      fetchTache: ((type: string, done: boolean) =>
        ok(type === "copy" && !done ? [raw] : [])) as any,
      postTache: (() => ok(null)) as any,
      fetchSyncList: (() => ok([])) as any,
      fetchSyncHistory: (() => ok([])) as any,
      fetchSyncJob: (() => ok(null)) as any,
      cancelSync: (() => ok(null)) as any,
      isAdmin: () => false,
      isHidden: () => false,
      notifyError: vi.fn(),
      info: vi.fn(),
      now: () => new Date(clock),
      storage: { getItem: () => null, setItem: () => {} },
      localUploads: local,
    }
    const store = createTransfersStore(deps)
    const done = local.add(
      {
        name: "a",
        path: "a",
        size: 1,
        progress: 100,
        speed: 0,
        status: "success",
      },
      "/a",
    )
    const running = local.add(
      {
        name: "b",
        path: "b",
        size: 1,
        progress: 5,
        speed: 0,
        status: "uploading",
      },
      "/b",
    )
    await store.refresh({ full: false })
    clock += 90_000
    await store.refresh({ full: false })
    expect(store.tasks().find((x) => x.id === "copy:1")?.stale).toBe(true)

    store.reset()
    expect(local.list().map((u) => u.id)).toEqual([running])
    expect(done).not.toBe(running)
    // the tracker forgot the old time: the same unchanged task is fresh again
    await store.refresh({ full: false })
    expect(store.tasks().find((x) => x.id === "copy:1")?.stale).toBe(false)
    store.dispose()
  })
})
