import { describe, it, expect, beforeEach } from "vitest"
import { readPersisted, writePersisted, type StorageLike } from "../persisted"

function memoryStorage(): StorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>()
  return {
    map,
    getItem: (k) => (map.has(k) ? map.get(k)! : null),
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  }
}

describe("readPersisted / writePersisted", () => {
  let store: ReturnType<typeof memoryStorage>
  beforeEach(() => {
    store = memoryStorage()
  })

  it("round-trips a value", () => {
    writePersisted(store, "k", { page: 3, q: "abc" })
    expect(readPersisted(store, "k", { page: 1, q: "" })).toEqual({
      page: 3,
      q: "abc",
    })
  })

  it("returns the fallback when the key is missing", () => {
    expect(readPersisted(store, "missing", 42)).toBe(42)
  })

  it("returns the fallback (no throw) on corrupt JSON", () => {
    store.map.set("bad", "{not json")
    expect(readPersisted(store, "bad", "safe")).toBe("safe")
  })

  it("removes the key when writing undefined", () => {
    writePersisted(store, "k", "v")
    writePersisted(store, "k", undefined)
    expect(store.getItem("k")).toBeNull()
  })

  it("namespaces nothing implicitly — keys are used verbatim", () => {
    writePersisted(store, "exact.key", 1)
    expect(store.getItem("exact.key")).toBe("1")
  })
})
