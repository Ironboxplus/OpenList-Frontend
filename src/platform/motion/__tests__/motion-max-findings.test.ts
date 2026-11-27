import { describe, expect, it } from "vitest"
import {
  MotionDriver,
  createViewAnimationRuntimeControl,
} from "../MotionDriver"
describe("Motion max regressions", () => {
  it("settles a completed group on cancel", async () => {
    let r!: () => void
    const p = {
      finished: new Promise<void>((x) => (r = x)),
      complete: () => r(),
    }
    const c = createViewAnimationRuntimeControl(p)
    c.cancel()
    await c.finished
    expect(true).toBe(true)
  })
  it("off commits final update", async () => {
    const d = new MotionDriver(),
      e = document.createElement("div")
    await d.animateView(() => {
      e.textContent = "ok"
    })
    expect(e.textContent).toBe("ok")
  })
})
