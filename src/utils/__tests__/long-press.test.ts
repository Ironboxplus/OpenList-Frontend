import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createLongPress, LONG_PRESS_MS } from "../touch"

const ptr = (x = 0, y = 0, pointerType = "touch") =>
  ({ clientX: x, clientY: y, pointerType, button: 0 }) as PointerEvent

describe("createLongPress", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it("fires after holding still and swallows the trailing click once", () => {
    const fn = vi.fn()
    const lp = createLongPress(fn)
    lp.onPointerDown(ptr())
    vi.advanceTimersByTime(LONG_PRESS_MS - 1)
    expect(fn).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(fn).toHaveBeenCalledTimes(1)
    lp.onPointerEnd()
    expect(lp.consumeClick()).toBe(true)
    expect(lp.consumeClick()).toBe(false)
  })

  it("a short tap is an ordinary click", () => {
    const fn = vi.fn()
    const lp = createLongPress(fn)
    lp.onPointerDown(ptr())
    vi.advanceTimersByTime(100)
    lp.onPointerEnd()
    vi.advanceTimersByTime(LONG_PRESS_MS)
    expect(fn).not.toHaveBeenCalled()
    expect(lp.consumeClick()).toBe(false)
  })

  it("moving the finger is a scroll, not a long press", () => {
    const fn = vi.fn()
    const lp = createLongPress(fn)
    lp.onPointerDown(ptr(10, 10))
    lp.onPointerMove(ptr(10, 40))
    vi.advanceTimersByTime(LONG_PRESS_MS * 2)
    expect(fn).not.toHaveBeenCalled()
  })

  it("jitter within the slop does not cancel", () => {
    const fn = vi.fn()
    const lp = createLongPress(fn)
    lp.onPointerDown(ptr(10, 10))
    lp.onPointerMove(ptr(12, 13))
    vi.advanceTimersByTime(LONG_PRESS_MS)
    expect(fn).toHaveBeenCalledTimes(1)
  })
})
