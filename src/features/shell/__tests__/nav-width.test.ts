import { describe, expect, it } from "vitest"
import {
  clampNavWidth,
  MAIN_MIN,
  NAV_MIN,
  NAV_WIDTH_KEY,
  navMax,
  readNavWidth,
  writeNavWidth,
} from "../nav-width"

const store = (init: Record<string, string> = {}) => {
  const m = new Map(Object.entries(init))
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
  }
}

describe("nav width", () => {
  it("is at most half the window, leaving the content its minimum", () => {
    expect(navMax(1440)).toBe(720)
    expect(navMax(1024)).toBe(512)
    expect(navMax(900)).toBe(900 - MAIN_MIN)
    // never below the default
    expect(navMax(500)).toBe(NAV_MIN)
  })

  it("clamps to [220, max]", () => {
    expect(clampNavWidth(100, 720)).toBe(NAV_MIN)
    expect(clampNavWidth(480.4, 720)).toBe(480)
    expect(clampNavWidth(2000, 720)).toBe(720)
  })

  it("reads the stored width, the default when absent or broken", () => {
    expect(readNavWidth(store())).toBe(NAV_MIN)
    expect(readNavWidth(store({ [NAV_WIDTH_KEY]: "nonsense" }))).toBe(NAV_MIN)
    expect(readNavWidth(store({ [NAV_WIDTH_KEY]: "100" }))).toBe(NAV_MIN)
    const s = store()
    writeNavWidth(s, 400)
    expect(readNavWidth(s)).toBe(400)
  })

  it("survives storage that throws", () => {
    const broken = {
      getItem: () => {
        throw new Error("denied")
      },
      setItem: () => {
        throw new Error("denied")
      },
    }
    expect(readNavWidth(broken)).toBe(NAV_MIN)
    expect(() => writeNavWidth(broken, 400)).not.toThrow()
  })
})
