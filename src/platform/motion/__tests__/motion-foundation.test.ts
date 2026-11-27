import { describe, expect, it } from "vitest"
import { MotionIntentManager } from "../MotionIntent"
import { MotionDriver } from "../MotionDriver"
import { MotionTokens } from "../MotionTokens"
import { SharedElementRegistry } from "../SharedElementRegistry"
describe("Motion foundation", () => {
  it("keeps tokens named", () =>
    expect(MotionTokens.duration.menuOpen).toBeGreaterThan(0))
  it("latest intent wins", () => {
    const m = new MotionIntentManager({ watchdogMs: 0 }),
      a = m.begin({ kind: "workspace", key: "workspace:primary" }),
      b = m.begin({ kind: "workspace", key: "workspace:primary" })
    expect(a.signal.aborted).toBe(true)
    expect(b.isCurrent()).toBe(true)
  })
  it("keeps replacement registration", () => {
    const r = new SharedElementRegistry(),
      a = document.createElement("i"),
      b = document.createElement("i"),
      x = r.register("x", a),
      y = r.register("x", b)
    r.unregister(x)
    expect(r.get("x")).toBe(b)
    r.unregister(y)
    expect(r.get("x")).toBeUndefined()
  })
  it("commits update without view transition", async () => {
    const d = new MotionDriver(),
      e = document.createElement("div")
    await d.animateView(() => {
      e.dataset.ok = "1"
    })
    expect(e.dataset.ok).toBe("1")
    d.animate(e, { opacity: [0, 1] }, MotionTokens.options.menuEnter)
    expect(e.style.opacity).toBe("1")
  })
})
