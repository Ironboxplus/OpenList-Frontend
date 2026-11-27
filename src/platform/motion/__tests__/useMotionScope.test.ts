import { createRoot } from "solid-js"
import { describe, expect, it } from "vitest"
import { useMotionScope } from "../useMotionScope"
describe("MotionScope", () =>
  it("cleans controls", () => {
    let n = 0
    let dispose!: () => void
    createRoot((d) => {
      dispose = d
      useMotionScope().track({ cancel: () => n++ })
    })
    dispose()
    expect(n).toBe(1)
  }))
