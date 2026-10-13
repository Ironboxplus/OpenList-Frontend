import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createPoller } from "../poll"

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe("createPoller", () => {
  it("runs at once, then every interval after the previous round settled", async () => {
    const tick = vi.fn(async () => {})
    const p = createPoller({ intervalMs: 5000, tick, isHidden: () => false })
    p.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(tick).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(5000)
    expect(tick).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(5000)
    expect(tick).toHaveBeenCalledTimes(3)
    p.stop()
    await vi.advanceTimersByTimeAsync(20000)
    expect(tick).toHaveBeenCalledTimes(3)
  })

  it("never overlaps rounds and keeps going after a failing tick", async () => {
    let release!: () => void
    const tick = vi
      .fn()
      .mockImplementationOnce(() => new Promise<void>((r) => (release = r)))
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValue(undefined)
    const p = createPoller({ intervalMs: 1000, tick, isHidden: () => false })
    p.start()
    await vi.advanceTimersByTimeAsync(0)
    void p.refresh() // folded into the running round
    await vi.advanceTimersByTimeAsync(3000)
    expect(tick).toHaveBeenCalledTimes(1)
    release()
    await vi.advanceTimersByTimeAsync(1000)
    expect(tick).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(1000)
    expect(tick).toHaveBeenCalledTimes(3)
    p.stop()
  })

  it("pauses while hidden and refreshes at once when visible again", async () => {
    let hidden = false
    const tick = vi.fn(async () => {})
    const p = createPoller({ intervalMs: 1000, tick, isHidden: () => hidden })
    p.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(tick).toHaveBeenCalledTimes(1)
    hidden = true
    document.dispatchEvent(new Event("visibilitychange"))
    await vi.advanceTimersByTimeAsync(10000)
    expect(tick).toHaveBeenCalledTimes(1)
    hidden = false
    document.dispatchEvent(new Event("visibilitychange"))
    await vi.advanceTimersByTimeAsync(0)
    expect(tick).toHaveBeenCalledTimes(2)
    p.stop()
  })

  it("does not start a round while hidden", async () => {
    const tick = vi.fn(async () => {})
    const p = createPoller({ intervalMs: 1000, tick, isHidden: () => true })
    p.start()
    await vi.advanceTimersByTimeAsync(5000)
    expect(tick).not.toHaveBeenCalled()
    p.stop()
  })
})
