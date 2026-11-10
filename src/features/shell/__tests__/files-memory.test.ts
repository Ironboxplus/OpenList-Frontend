import { describe, expect, it } from "vitest"
import { readSpot, resolveNavPath, SPOT_KEY, writeSpot } from "../files-memory"

const store = (initial?: string) => {
  const m = new Map<string, string>(initial ? [[SPOT_KEY, initial]] : [])
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  }
}

describe("resolveNavPath", () => {
  const spot = { path: "/示例/照片/2026 旅行", scroll: 420 }

  it("sends Files from another section back to the remembered folder", () => {
    expect(resolveNavPath("/", "/@transfers", spot)).toBe(
      "/%E7%A4%BA%E4%BE%8B/%E7%85%A7%E7%89%87/2026%20%E6%97%85%E8%A1%8C",
    )
    expect(resolveNavPath("/", "/@manage/storages", spot)).not.toBe("/")
  })

  it("goes to the root when already in the files section", () => {
    expect(resolveNavPath("/", "/示例", spot)).toBe("/")
    expect(resolveNavPath("/", "/", spot)).toBe("/")
  })

  it("leaves other links and an empty memory alone", () => {
    expect(resolveNavPath("/@transfers", "/示例", spot)).toBe("/@transfers")
    expect(resolveNavPath("/", "/@transfers", undefined)).toBe("/")
  })
})

describe("readSpot / writeSpot", () => {
  it("round-trips a spot and forgets it", () => {
    const s = store()
    writeSpot(s, { path: "/a/b", scroll: 12 })
    expect(readSpot(s)).toEqual({ path: "/a/b", scroll: 12 })
    writeSpot(s, undefined)
    expect(readSpot(s)).toBeUndefined()
  })

  it("rejects garbage", () => {
    expect(readSpot(store("nope"))).toBeUndefined()
    expect(readSpot(store('{"path":"a","scroll":1}'))).toBeUndefined()
    expect(readSpot(store('{"path":"/a","scroll":"x"}'))).toBeUndefined()
    expect(readSpot(store('{"path":"/a","scroll":-5}'))).toEqual({
      path: "/a",
      scroll: 0,
    })
  })
})
