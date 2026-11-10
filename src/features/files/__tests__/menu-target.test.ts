import { describe, expect, it } from "vitest"
import { markMenuTarget, takeMenuTarget } from "../menu-target"

describe("menu target", () => {
  it("is claimed once per event", () => {
    expect(takeMenuTarget()).toBe(false)
    markMenuTarget()
    expect(takeMenuTarget()).toBe(true)
    expect(takeMenuTarget()).toBe(false)
  })
})
