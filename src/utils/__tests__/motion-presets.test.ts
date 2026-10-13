import { afterEach, describe, it, expect, vi } from "vitest"
import {
  fadeScaleIn,
  motionProps,
  motionTransition,
  navIndicatorMove,
  pageTransition,
  sectionEnter,
} from "../motion-presets"

describe("presets", () => {
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

const reduced = (on: boolean) =>
  vi.stubGlobal("matchMedia", (q: string) => ({
    matches: on && q.includes("prefers-reduced-motion"),
  }))

describe("reduced motion", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("sectionEnter is a short fade and rise, and has no exit", () => {
    expect(sectionEnter.initial).toEqual({ opacity: 0.001, y: 6 })
    expect(sectionEnter.animate).toEqual({ opacity: 1, y: 0 })
    expect(sectionEnter.transition.duration).toBe(0.16)
    expect(sectionEnter.exit).toBeUndefined()
  })

  it("motionProps passes the preset through normally", () => {
    reduced(false)
    expect(motionProps(sectionEnter)).toBe(sectionEnter)
  })

  it("motionProps is a no-op under reduced motion", () => {
    reduced(true)
    expect(motionProps(sectionEnter)).toEqual({})
  })

  it("motionTransition takes no time under reduced motion", () => {
    reduced(false)
    expect(motionTransition(navIndicatorMove)).toBe(navIndicatorMove)
    reduced(true)
    expect(motionTransition(navIndicatorMove)).toEqual({ duration: 0 })
  })
})
