import { describe, it, expect, afterEach, vi } from "vitest"
import { hasCoarsePointer, isTouchDevice } from "../touch"

// Helpers to stub the browser environment that the touch detection relies on.
function stubMatchMedia(matches: boolean | "undefined") {
  if (matches === "undefined") {
    // Simulate environments (e.g. older jsdom) without matchMedia.
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: undefined,
    })
    return
  }
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockReturnValue({
      matches,
      media: "",
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  })
}

function stubTouchPoints(n: number) {
  Object.defineProperty(window.navigator, "maxTouchPoints", {
    configurable: true,
    value: n,
  })
}

afterEach(() => {
  // Reset to a clean desktop-like environment between tests.
  stubMatchMedia(false)
  stubTouchPoints(0)
})

describe("hasCoarsePointer", () => {
  it("returns true when the media query matches", () => {
    stubMatchMedia(true)
    expect(hasCoarsePointer()).toBe(true)
  })

  it("returns false when the media query does not match", () => {
    stubMatchMedia(false)
    expect(hasCoarsePointer()).toBe(false)
  })

  it("returns false (no throw) when matchMedia is unavailable", () => {
    stubMatchMedia("undefined")
    expect(hasCoarsePointer()).toBe(false)
  })
})

describe("isTouchDevice", () => {
  it("is true when the pointer is coarse", () => {
    stubMatchMedia(true)
    stubTouchPoints(0)
    expect(isTouchDevice()).toBe(true)
  })

  it("is true when the device reports touch points", () => {
    stubMatchMedia(false)
    stubTouchPoints(5)
    expect(isTouchDevice()).toBe(true)
  })

  it("is false on a plain desktop (fine pointer, no touch points)", () => {
    stubMatchMedia(false)
    stubTouchPoints(0)
    expect(isTouchDevice()).toBe(false)
  })
})
