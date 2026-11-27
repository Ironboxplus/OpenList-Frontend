import fs from "node:fs"
import path from "node:path"
import { createRoot, createSignal, getOwner, runWithOwner } from "solid-js"
import { afterEach, describe, expect, it, vi } from "vitest"

const calls: { keyframes: any; options: any }[] = []
vi.mock("motion", () => ({
  animate: (_el: Element, keyframes: any, options: any) => {
    calls.push({ keyframes, options })
    return { finished: Promise.resolve(), stop() {}, complete() {} }
  },
  animateView: vi.fn(),
}))

import { MotionDriver } from "../MotionDriver"
import { MotionTokens, cssVariableOf } from "../MotionTokens"
import { createMotionPreference } from "../ReducedMotion"
import { overlayMotion, scrimMotion } from "../overlays"
import { createPresence } from "../presence"

const css = fs.readFileSync(
  path.resolve(process.cwd(), "src/app/tokens.css"),
  "utf8",
)
/** The --motion-* declarations of the first `:root` block that has them. */
const rootVariables = () => {
  const out: Record<string, string> = {}
  const block = css.slice(0, css.indexOf("@media (prefers-reduced-motion"))
  for (const m of block.matchAll(/(--motion-[a-z-]+):\s*([^;]+);/g))
    out[m[1]] = m[2].trim()
  return out
}

/** An element that looks animatable to the driver (jsdom has no Element.animate). */
const animatable = () => {
  const el = document.createElement("div")
  ;(el as any).animate = () => {}
  document.body.appendChild(el)
  return el
}

const tick = () => new Promise((r) => setTimeout(r, 0))

afterEach(() => {
  calls.length = 0
  document.body.innerHTML = ""
})

describe("motion tokens", () => {
  it("are the plan's durations (02 §三, 05 §二)", () => {
    const d = MotionTokens.duration
    expect([d.dialogOpen, d.dialogClose]).toEqual([200, 150])
    expect([d.sheetOpen, d.sheetClose]).toEqual([250, 200])
    expect([d.menuOpen, d.menuClose]).toEqual([120, 90])
    expect([d.collapseOpen, d.collapseClose, d.collapseLead]).toEqual([
      220, 180, 40,
    ])
  })

  it("equal the --motion-* variables of tokens.css", () => {
    const vars = rootVariables()
    for (const [name, ms] of Object.entries(MotionTokens.duration))
      expect([name, vars[cssVariableOf(name)]]).toEqual([name, `${ms}ms`])
    for (const [name, c] of Object.entries(MotionTokens.ease))
      expect([name, vars[cssVariableOf(name)]]).toEqual([
        name,
        `cubic-bezier(${c.join(", ")})`,
      ])
    // and nothing in tokens.css that the tokens do not have
    const known = new Set(
      [
        ...Object.keys(MotionTokens.duration),
        ...Object.keys(MotionTokens.ease),
      ].map(cssVariableOf),
    )
    expect(Object.keys(vars).filter((v) => !known.has(v))).toEqual([])
  })

  it("tokens.css shortens every duration under reduced motion", () => {
    const reduced = css.slice(css.indexOf("@media (prefers-reduced-motion"))
    for (const [name, ms] of Object.entries(MotionTokens.duration)) {
      // the watchdog is no animation; the rest at most 100ms already
      if (name === "watchdog" || ms <= 100) continue
      const m = reduced.match(new RegExp(`${cssVariableOf(name)}:\\s*(\\d+)ms`))
      expect([name, m && Number(m[1]) <= 100]).toEqual([name, true])
    }
  })

  it("leaves no stand-in animation classes in tokens.css", () => {
    expect(css).not.toMatch(/animate-in|fade-in-0|zoom-in-95|slide-in-from/)
  })
})

describe("MotionDriver levels", () => {
  it("expressive runs what was asked for and writes the first frame", () => {
    const d = new MotionDriver()
    const el = animatable()
    d.animate(
      el,
      { opacity: [0, 1], transform: ["scale(0.95)", "none"] },
      MotionTokens.options.dialogEnter,
    )
    expect(el.style.opacity).toBe("0")
    expect(calls[0].keyframes).toEqual({
      opacity: [0, 1],
      transform: ["scale(0.95)", "none"],
    })
    expect(calls[0].options).toEqual({
      duration: 0.2,
      ease: [0.05, 0.7, 0.1, 1],
    })
  })

  it("subtle keeps only a short linear fade and lands the rest at once", () => {
    const d = new MotionDriver({
      preference: createMotionPreference({ initial: "subtle" }),
    })
    const el = animatable()
    d.animate(
      el,
      { opacity: [0, 1], transform: ["translateX(100%)", "translateX(0%)"] },
      MotionTokens.options.sheetEnter,
    )
    expect(el.style.transform).toBe("translateX(0%)")
    expect(calls[0].keyframes).toEqual({ opacity: [0, 1] })
    expect(calls[0].options).toEqual({ duration: 0.1, ease: "linear" })
  })

  it("subtle leaves what fades out where it is", () => {
    const d = new MotionDriver({
      preference: createMotionPreference({ initial: "subtle" }),
    })
    const el = animatable()
    el.style.transform = "translateX(0%)"
    d.animate(
      el,
      { opacity: [null, 0], transform: [null, "translateX(100%)"] },
      MotionTokens.options.sheetExit,
    )
    expect(el.style.transform).toBe("translateX(0%)")
    expect(calls[0].keyframes).toEqual({ opacity: [null, 0] })
  })

  it("subtle with nothing to fade does not animate", async () => {
    const d = new MotionDriver({
      preference: createMotionPreference({ initial: "subtle" }),
    })
    const el = animatable()
    const c = d.animate(el, { height: [0, 40] }, MotionTokens.options.pane)
    await c.finished
    expect(calls).toEqual([])
    expect(el.style.height).toBe("40px")
    expect(c.state).toBe("finished")
  })

  it("off lands at the end state without animating", async () => {
    const d = new MotionDriver({
      preference: createMotionPreference({ initial: "off" }),
    })
    const el = animatable()
    const c = d.animate(
      el,
      { opacity: [null, 0], transform: [null, "scale(0.95)"] },
      MotionTokens.options.menuExit,
    )
    await c.finished
    expect(calls).toEqual([])
    expect(el.style.opacity).toBe("0")
    expect(el.style.transform).toBe("scale(0.95)")
  })
})

describe("overlay motions", () => {
  it("use the tokens of their kind", () => {
    const o = MotionTokens.options
    expect(overlayMotion("dialog").enter[1]).toBe(o.dialogEnter)
    expect(overlayMotion("dialog").exit[1]).toBe(o.dialogExit)
    expect(overlayMotion("sheet").enter[1]).toBe(o.sheetEnter)
    expect(overlayMotion("sheet").exit[1]).toBe(o.sheetExit)
    for (const k of ["menu", "select", "popover", "tooltip"] as const) {
      expect(overlayMotion(k).enter[1]).toBe(o.menuEnter)
      expect(overlayMotion(k).exit[1]).toBe(o.menuExit)
    }
    expect(scrimMotion("sheet").exit[1]).toBe(o.sheetExit)
  })

  it("slide a sheet in from its own edge", () => {
    expect(overlayMotion("sheet", "bottom").enter[0].transform).toEqual([
      "translateY(100%)",
      "translateY(0%)",
    ])
    expect(overlayMotion("sheet", "left").enter[0].transform).toEqual([
      "translateX(-100%)",
      "translateX(0%)",
    ])
  })

  it("come to rest at full size, never at motion's zero for none", () => {
    // motion turns a "none" keyframe into scale(0): menus shrank to nothing
    for (const k of ["dialog", "menu", "sheet"] as const)
      expect((overlayMotion(k).enter[0].transform as string[])[1]).not.toBe(
        "none",
      )
    expect(overlayMotion("menu").enter[0].transform).toEqual([
      "scale(0.95)",
      "scale(1)",
    ])
  })

  it("leave from where they are", () => {
    const exit = overlayMotion("dialog").exit[0]
    expect(exit.opacity).toEqual([null, 0])
    expect((exit.transform as unknown[])[0]).toBeNull()
  })
})

describe("createPresence", () => {
  const part = overlayMotion("menu")
  /** A presence in its own root, so its effect is live when the test acts. */
  const setup = (initial: boolean) =>
    createRoot((dispose) => {
      const [open, setOpen] = createSignal(initial)
      const p = createPresence(open)
      const owner = getOwner()
      const mount = () => {
        const el = document.createElement("div")
        runWithOwner(owner, () => p.part(part)(el))
        return el
      }
      return { setOpen, p, mount, dispose }
    })
  /** Animations that finish at once, except exits, which finish on `release`. */
  const holdExits = () => {
    let release!: () => void
    const exitFinished = new Promise<void>((r) => (release = r))
    const runs: { k: any; o: any }[] = []
    vi.spyOn(MotionDriver.prototype, "animate").mockImplementation(
      (_el, k, o) => {
        runs.push({ k, o })
        return {
          state: "running",
          finished:
            o === MotionTokens.options.menuExit
              ? exitFinished
              : Promise.resolve(),
          cancel() {},
          finish() {},
        } as any
      },
    )
    return { runs, release: () => (release(), exitFinished) }
  }
  afterEach(() => vi.restoreAllMocks())

  it("stays present until the exit has finished", async () => {
    const exits = holdExits()
    const t = setup(true)
    const el = t.mount()
    t.setOpen(false)
    await tick()
    expect(t.p.present()).toBe(true)
    expect(el.style.pointerEvents).toBe("none")
    await exits.release()
    await tick()
    expect(t.p.present()).toBe(false)
    t.dispose()
  })

  it("turns round when opened again during the exit", async () => {
    const exits = holdExits()
    const t = setup(true)
    const el = t.mount()
    t.setOpen(false)
    t.setOpen(true)
    await exits.release()
    await tick()
    expect(t.p.present()).toBe(true)
    const last = exits.runs[exits.runs.length - 1]
    expect(last.o).toBe(MotionTokens.options.menuEnter)
    // from where it is, not from 0
    expect(last.k.opacity).toEqual([null, 1])
    expect(el.style.pointerEvents).toBe("")
    t.dispose()
  })

  it("mounts a part entering when opened from closed", () => {
    const t = setup(false)
    expect(t.p.present()).toBe(false)
    t.setOpen(true)
    expect(t.p.present()).toBe(true)
    const el = t.mount()
    // jsdom cannot animate: the driver lands the enter at its end
    expect(el.style.opacity).toBe("1")
    expect(el.style.transform).toBe("scale(1)")
    t.dispose()
  })

  it("drops the resting transform once the part has entered", async () => {
    const t = setup(true)
    const el = t.mount()
    await tick()
    // kept inline, scale(1) would be the containing block of fixed children
    expect(el.style.transform).toBe("")
    t.dispose()
  })
})
