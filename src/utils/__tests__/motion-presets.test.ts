import { describe, it, expect } from "vitest"
import {
  staggerDelay,
  listItemIn,
  pageTransition,
  fadeScaleIn,
} from "../motion-presets"

describe("staggerDelay", () => {
  it("scales linearly with index", () => {
    expect(staggerDelay(0)).toBe(0)
    expect(staggerDelay(1, 0.03)).toBeCloseTo(0.03)
    expect(staggerDelay(3, 0.03)).toBeCloseTo(0.09)
  })

  it("is clamped to the max so long lists don't crawl in", () => {
    expect(staggerDelay(1000, 0.03, 0.3)).toBe(0.3)
  })

  it("never returns a negative delay for a negative index", () => {
    expect(staggerDelay(-5)).toBe(0)
  })
})

describe("listItemIn", () => {
  it("produces a fade+scale enter with an index-based delay", () => {
    const a = listItemIn(0)
    expect(a.initial).toEqual({ opacity: 0, scale: 0.95 })
    expect(a.animate).toEqual({ opacity: 1, scale: 1 })
    expect(a.transition.delay).toBe(0)

    const b = listItemIn(2)
    expect(b.transition.delay).toBeGreaterThan(0)
  })
})

describe("static presets", () => {
  it("pageTransition has enter and exit states", () => {
    expect(pageTransition.initial).toBeDefined()
    expect(pageTransition.animate).toBeDefined()
    expect(pageTransition.exit).toBeDefined()
  })

  it("fadeScaleIn is a plain enter preset", () => {
    expect(fadeScaleIn.initial).toEqual({ opacity: 0, scale: 0.95 })
    expect(fadeScaleIn.animate).toEqual({ opacity: 1, scale: 1 })
  })
})
