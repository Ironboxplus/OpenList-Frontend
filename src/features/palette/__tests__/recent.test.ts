import { describe, expect, it } from "vitest"
import { MAX_RECENT, pushRecent, readRecent, RECENT_KEY } from "../recent"
import { isPaletteHotkey } from "../state"

const memory = (initial?: string) => {
  const map = new Map<string, string>()
  if (initial !== undefined) map.set(RECENT_KEY, initial)
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
  }
}

describe("recent", () => {
  it("starts empty", () => {
    expect(readRecent(memory())).toEqual([])
  })

  it("puts the newest first and moves repeats to the front", () => {
    const s = memory()
    pushRecent(s, "a")
    pushRecent(s, "b")
    expect(pushRecent(s, "a")).toEqual(["a", "b"])
    expect(readRecent(s)).toEqual(["a", "b"])
  })

  it("keeps only the last five", () => {
    const s = memory()
    for (const id of ["1", "2", "3", "4", "5", "6", "7"]) pushRecent(s, id)
    const list = readRecent(s)
    expect(list).toHaveLength(MAX_RECENT)
    expect(list).toEqual(["7", "6", "5", "4", "3"])
  })

  it("survives corrupt storage", () => {
    expect(readRecent(memory("{nope"))).toEqual([])
    expect(readRecent(memory('{"a":1}'))).toEqual([])
    expect(readRecent(memory('["a",3,null,"b"]'))).toEqual(["a", "b"])
  })

  it("survives a storage that throws", () => {
    const broken = {
      getItem: () => {
        throw new Error("blocked")
      },
      setItem: () => {
        throw new Error("blocked")
      },
    }
    expect(readRecent(broken)).toEqual([])
    expect(pushRecent(broken, "a")).toEqual(["a"])
  })
})

describe("isPaletteHotkey", () => {
  const key = (over: Partial<Parameters<typeof isPaletteHotkey>[0]>) => ({
    key: "k",
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    ...over,
  })
  it("accepts Ctrl+K and Cmd+K in either case", () => {
    expect(isPaletteHotkey(key({ ctrlKey: true }))).toBe(true)
    expect(isPaletteHotkey(key({ metaKey: true }))).toBe(true)
    expect(isPaletteHotkey(key({ ctrlKey: true, key: "K" }))).toBe(true)
  })
  it("rejects bare K, other keys and extra modifiers", () => {
    expect(isPaletteHotkey(key({}))).toBe(false)
    expect(isPaletteHotkey(key({ ctrlKey: true, key: "j" }))).toBe(false)
    expect(isPaletteHotkey(key({ ctrlKey: true, shiftKey: true }))).toBe(false)
    expect(isPaletteHotkey(key({ ctrlKey: true, altKey: true }))).toBe(false)
  })
})
