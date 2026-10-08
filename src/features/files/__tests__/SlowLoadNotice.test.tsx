import { cleanup, fireEvent, render } from "@solidjs/testing-library"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("~/hooks", () => ({
  useT: () => (k: string, v?: Record<string, unknown>) =>
    v ? `${k}:${v.n}` : k,
}))

import { SlowLoadNotice } from "../FilesState"

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe("SlowLoadNotice", () => {
  it("is silent for the first 3 s, then counts seconds", () => {
    const v = render(() => <SlowLoadNotice onRetry={() => {}} />)
    vi.advanceTimersByTime(2000)
    expect(v.container.querySelector("[data-files-state=slow]")).toBeNull()
    vi.advanceTimersByTime(1000)
    expect(v.container.querySelector("[data-slow-text]")!.textContent).toBe(
      "files.slow:3",
    )
    vi.advanceTimersByTime(7000)
    expect(v.container.querySelector("[data-slow-text]")!.textContent).toBe(
      "files.slow:10",
    )
    expect(v.container.querySelector("[data-files-retry]")).toBeNull()
  })

  it("offers retry after 60 s, and the button retries", () => {
    const retry = vi.fn()
    const v = render(() => <SlowLoadNotice onRetry={retry} />)
    vi.advanceTimersByTime(59_000)
    expect(v.container.querySelector("[data-files-retry]")).toBeNull()
    vi.advanceTimersByTime(1000)
    fireEvent.click(v.container.querySelector("[data-files-retry]")!)
    expect(retry).toHaveBeenCalledTimes(1)
  })

  it("stops counting when the skeleton goes away", () => {
    const v = render(() => <SlowLoadNotice onRetry={() => {}} />)
    cleanup()
    expect(vi.getTimerCount()).toBe(0)
    expect(v.container.querySelector("[data-files-state=slow]")).toBeNull()
  })
})
