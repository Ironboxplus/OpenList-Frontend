import { describe, expect, it } from "vitest"
import { healthy, pollFailed, pollSucceeded, STALE_AFTER } from "../poll-health"

describe("poll health", () => {
  it("is not stale before the threshold", () => {
    let h = healthy
    for (let i = 1; i < STALE_AFTER; i++) {
      h = pollFailed(h)
      expect(h.stale).toBe(false)
      expect(h.failures).toBe(i)
    }
  })

  it("turns stale on the third consecutive failure and stays stale", () => {
    let h = healthy
    for (let i = 0; i < STALE_AFTER; i++) h = pollFailed(h)
    expect(h).toEqual({ failures: 3, stale: true })
    h = pollFailed(h)
    expect(h.stale).toBe(true)
  })

  it("a success clears it", () => {
    let h = healthy
    for (let i = 0; i < 5; i++) h = pollFailed(h)
    expect(pollSucceeded()).toEqual({ failures: 0, stale: false })
  })

  it("failures must be consecutive", () => {
    let h = pollFailed(pollFailed(healthy))
    h = pollSucceeded()
    h = pollFailed(h)
    expect(h.stale).toBe(false)
  })
})
