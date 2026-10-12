import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  HIGHLIGHT_MS,
  highlighted,
  nudge,
  pointAtTasks,
  resetTaskCenterPointer,
  setTaskCenterOpen,
} from "../task-center"

describe("pointAtTasks", () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    resetTaskCenterPointer()
    setTaskCenterOpen(false)
    vi.useRealTimers()
  })

  it("highlights the tasks for three seconds while the drawer is open", () => {
    setTaskCenterOpen(true)
    pointAtTasks(["copy:1", "copy:2"])
    expect([...highlighted()]).toEqual(["copy:1", "copy:2"])
    expect(nudge()).toBe(0)
    vi.advanceTimersByTime(HIGHLIGHT_MS - 1)
    expect(highlighted().size).toBe(2)
    vi.advanceTimersByTime(1)
    expect(highlighted().size).toBe(0)
  })

  it("a newer highlight is not cut short by the older timer", () => {
    setTaskCenterOpen(true)
    pointAtTasks(["copy:1"])
    vi.advanceTimersByTime(2000)
    pointAtTasks(["move:2"])
    vi.advanceTimersByTime(2000)
    expect([...highlighted()]).toEqual(["move:2"])
    vi.advanceTimersByTime(1000)
    expect(highlighted().size).toBe(0)
  })

  it("nudges the badge instead when the drawer is closed, and never opens it", () => {
    pointAtTasks(["copy:1"])
    expect(nudge()).toBe(1)
    expect(highlighted().size).toBe(0)
    pointAtTasks(["copy:2"])
    expect(nudge()).toBe(2)
  })

  it("ignores an empty list", () => {
    pointAtTasks([])
    expect(nudge()).toBe(0)
  })
})
