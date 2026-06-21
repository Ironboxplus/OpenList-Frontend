import { describe, it, expect } from "vitest"
import { loadingSummary, type LoadingSnapshot } from "../loading-progress"

const snap = (p: Partial<LoadingSnapshot>): LoadingSnapshot => ({
  total: 0,
  pending: 0,
  loading: 0,
  loaded: 0,
  failed: 0,
  finished: false,
  items: [],
  ...p,
})

describe("loadingSummary", () => {
  it("computes percent from settled (loaded+failed) over total", () => {
    const s = loadingSummary(
      snap({ total: 4, loaded: 2, failed: 1, loading: 1 }),
    )
    expect(s.settled).toBe(3)
    expect(s.percent).toBe(75)
  })

  it("reports 100 percent and done when finished", () => {
    const s = loadingSummary(snap({ total: 2, loaded: 2, finished: true }))
    expect(s.percent).toBe(100)
    expect(s.done).toBe(true)
  })

  it("treats an empty/zero-total snapshot as done at 100 percent", () => {
    const s = loadingSummary(snap({ total: 0, finished: true }))
    expect(s.percent).toBe(100)
    expect(s.done).toBe(true)
  })

  it("is not done while storages are still pending or loading", () => {
    const s = loadingSummary(
      snap({ total: 3, loaded: 1, loading: 1, pending: 1 }),
    )
    expect(s.done).toBe(false)
    expect(s.percent).toBe(33)
  })

  it("exposes the count of failed storages and whether any failed", () => {
    const s = loadingSummary(
      snap({ total: 2, loaded: 1, failed: 1, finished: true }),
    )
    expect(s.failed).toBe(1)
    expect(s.hasFailures).toBe(true)
  })

  it("has no failures when none failed", () => {
    const s = loadingSummary(snap({ total: 2, loaded: 2, finished: true }))
    expect(s.hasFailures).toBe(false)
  })
})
