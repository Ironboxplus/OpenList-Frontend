import { createSignal } from "solid-js"
import { describe, expect, it } from "vitest"
import {
  createErrorStore,
  DEDUPE_MS,
  MAX_RECORDS,
  type ErrorInput,
} from "../store"

const memory = () => {
  const m = new Map<string, string>()
  return {
    m,
    storage: {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => void m.set(k, v),
    },
  }
}

const setup = () => {
  const { m, storage } = memory()
  const [user, setUser] = createSignal("alice")
  let t = 1_000_000
  const store = createErrorStore({ storage, user, now: () => t })
  return { store, m, setUser, tick: (ms: number) => (t += ms) }
}

const err = (over: Partial<ErrorInput> = {}): ErrorInput => ({
  category: "internal",
  source: "/fs/list",
  message: "disk full",
  ...over,
})

describe("recording", () => {
  it("keeps newest first, unread", () => {
    const { store, tick } = setup()
    store.record(err({ message: "a" }))
    tick(DEDUPE_MS + 1)
    store.record(err({ message: "b" }))
    expect(store.records().map((r) => r.message)).toEqual(["b", "a"])
    expect(store.unreadCount()).toBe(2)
    store.dispose()
  })

  it("folds the same source + message within ten seconds into one, counting", () => {
    const { store, tick } = setup()
    store.record(err())
    tick(DEDUPE_MS - 1)
    store.record(err())
    expect(store.records()).toHaveLength(1)
    expect(store.records()[0].count).toBe(2)
    // a different source or message is a new record
    store.record(err({ source: "/fs/get" }))
    store.record(err({ message: "other" }))
    expect(store.records()).toHaveLength(3)
    store.dispose()
  })

  it("starts a new record after the window, and a repeat turns unread again", () => {
    const { store, tick } = setup()
    store.record(err())
    store.markAllRead()
    tick(1000)
    store.record(err())
    expect(store.records()[0].read).toBe(false)
    expect(store.unreadCount()).toBe(1)
    tick(DEDUPE_MS + 1)
    store.record(err())
    expect(store.records()).toHaveLength(2)
    store.dispose()
  })

  it("keeps at most 200, dropping the oldest", () => {
    const { store, tick } = setup()
    for (let i = 0; i < MAX_RECORDS + 20; i++) {
      tick(DEDUPE_MS + 1)
      store.record(err({ message: `m${i}` }))
    }
    expect(store.records()).toHaveLength(MAX_RECORDS)
    expect(store.records()[0].message).toBe(`m${MAX_RECORDS + 19}`)
    expect(store.records().at(-1)!.message).toBe("m20")
    store.dispose()
  })

  it("does not record sign-in (401) failures, canceled requests or empty messages", () => {
    const { store } = setup()
    expect(store.record(err({ category: "auth" }))).toBe(false)
    expect(store.record(err({ category: "canceled" }))).toBe(false)
    expect(store.record(err({ message: undefined }))).toBe(false)
    expect(store.record(err({ message: "  " }))).toBe(false)
    expect(store.records()).toHaveLength(0)
    store.dispose()
  })

  it("records a task once however often it is reported", () => {
    const { store, tick } = setup()
    store.record(err({ taskId: "copy:1" }))
    tick(DEDUPE_MS * 5)
    expect(store.record(err({ taskId: "copy:1", message: "again" }))).toBe(
      false,
    )
    expect(store.records()).toHaveLength(1)
    store.dispose()
  })
})

describe("read state and clearing", () => {
  it("marks everything read and clears", () => {
    const { store, tick } = setup()
    store.record(err({ message: "a" }))
    tick(DEDUPE_MS + 1)
    store.record(err({ message: "b" }))
    store.markAllRead()
    expect(store.unreadCount()).toBe(0)
    expect(store.records()).toHaveLength(2)
    store.clear()
    expect(store.records()).toHaveLength(0)
    store.dispose()
  })
})

describe("persistence per user", () => {
  it("survives a reload of the same user", () => {
    const { m, storage } = memory()
    const a = createErrorStore({ storage, user: () => "alice", now: () => 5 })
    a.record(err())
    a.dispose()
    const b = createErrorStore({ storage, user: () => "alice", now: () => 6 })
    expect(b.records().map((r) => r.message)).toEqual(["disk full"])
    expect([...m.keys()]).toEqual(["error-center:alice"])
    b.dispose()
  })

  it("keeps users apart and swaps the list when the user changes", () => {
    const { store, setUser, tick } = setup()
    store.record(err({ message: "alice's" }))
    setUser("bob")
    expect(store.records()).toHaveLength(0)
    tick(DEDUPE_MS + 1)
    store.record(err({ message: "bob's" }))
    expect(store.records().map((r) => r.message)).toEqual(["bob's"])
    setUser("alice")
    expect(store.records().map((r) => r.message)).toEqual(["alice's"])
    store.dispose()
  })

  it("starts empty on corrupt storage", () => {
    const { m, storage } = memory()
    m.set("error-center:alice", "{not json")
    const s = createErrorStore({ storage, user: () => "alice", now: () => 1 })
    expect(s.records()).toEqual([])
    s.dispose()
  })
})
