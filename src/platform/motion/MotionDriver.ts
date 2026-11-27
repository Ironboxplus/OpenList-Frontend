// The one way the app animates: `motion`'s DOM API behind the user's motion
// level. Expressive runs what was asked for; subtle (the system asks for
// reduced motion) keeps only the opacity, at most 100ms and linear, and puts
// everything else at its end state at once; off puts all of it at its end
// state. The caller gets a control that settles exactly once.
import { animate, animateView } from "motion"
import type { AnimationOptions, DOMKeyframesDefinition } from "motion"
import type { MotionIntentLease } from "./MotionIntent"
import { MotionTokens, type MotionOptions } from "./MotionTokens"
import type { MotionLevel, MotionPreferenceController } from "./ReducedMotion"

/**
 * Property -> [from, to] or a single end value. Use CSS properties (opacity,
 * transform, height, ...): they run on the browser's own animations where it
 * can, and the end state can be written as a style. A `null` start means
 * "from where it is now".
 */
export type MotionKeyframes = Record<
  string,
  string | number | readonly (string | number | null)[]
>

export interface MotionControl {
  readonly state: "running" | "finished" | "cancelled"
  readonly finished: Promise<void>
  cancel(): void
  finish(): void
}
export interface ViewAnimationRuntimeControl {
  readonly finished: Promise<unknown>
  cancel(): void
  finish(): void
}
export interface ViewAnimationRuntime {
  start(
    update: () => void | Promise<void>,
    request: {
      options?: MotionOptions
      shared?: readonly [Element | string, Element | string]
    },
  ): Promise<ViewAnimationRuntimeControl>
}
type Native = {
  finished?: Promise<unknown>
  cancel?: () => void
  stop?: () => void
  complete?: () => void
}

const UNITLESS = new Set(["opacity", "zIndex", "flexGrow", "scale"])
const last = (v: MotionKeyframes[string]) =>
  Array.isArray(v) ? v[v.length - 1] : (v as string | number)
const first = (v: MotionKeyframes[string]) =>
  Array.isArray(v) ? v[0] : undefined
const kebab = (p: string) => p.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)

/** Writes one keyframe of each property as an inline style. */
export const setStyles = (
  el: Element,
  k: MotionKeyframes,
  pick: (v: MotionKeyframes[string]) => string | number | null | undefined,
) => {
  const style = (el as HTMLElement).style
  if (!style) return
  for (const [p, v] of Object.entries(k)) {
    const x = pick(v)
    if (x === null || x === undefined) continue
    style.setProperty(
      kebab(p),
      typeof x === "number" && !UNITLESS.has(p) ? `${x}px` : String(x),
    )
  }
}

class Control implements MotionControl {
  state: "running" | "finished" | "cancelled" = "running"
  resolve!: () => void
  finished = new Promise<void>((r) => (this.resolve = r))
  native?: Native | ViewAnimationRuntimeControl
  /** Puts the end state in place when there is no animation to complete. */
  settle?: () => void
  attach(n: Native | ViewAnimationRuntimeControl) {
    this.native = n
    if (this.state === "cancelled") n.cancel?.()
    if (this.state === "finished") this.finishNative()
    void n.finished?.then(
      () => this.set("finished"),
      () => this.set("cancelled"),
    )
  }
  cancel() {
    if (this.state === "running") {
      // stop where it is: the next animation starts from here
      const n = this.native as Native | undefined
      if (n?.stop) n.stop()
      else n?.cancel?.()
      this.set("cancelled")
    }
  }
  finish() {
    if (this.state === "running") {
      this.finishNative()
      this.set("finished")
    }
  }
  finishNative() {
    const n = this.native as Native | undefined
    if (!n) return this.settle?.()
    ;(n as ViewAnimationRuntimeControl | undefined)?.finish?.()
    n?.complete?.()
  }
  set(s: "finished" | "cancelled") {
    if (this.state === "running") {
      this.state = s
      this.resolve()
    }
  }
}
interface Playback {
  finished: Promise<unknown>
  complete?: () => void
}
export function createViewAnimationRuntimeControl(
  p: Playback,
): ViewAnimationRuntimeControl {
  let done!: () => void
  const cancelled = new Promise<void>((r) => (done = r))
  return {
    finished: Promise.race([p.finished, cancelled]),
    cancel: () => {
      p.complete?.()
      done()
    },
    finish: () => {
      p.complete?.()
    },
  }
}
class BrowserRuntime implements ViewAnimationRuntime {
  async start(
    update: () => void | Promise<void>,
    r: {
      options?: MotionOptions
      shared?: readonly [Element | string, Element | string]
    },
  ) {
    const b = animateView(update, r.options as AnimationOptions)
    if (r.shared) b.add(r.shared[0], r.shared[1])
    const p: any = await b
    return createViewAnimationRuntimeControl(p)
  }
}
export interface ViewAnimationSpec {
  intentId?: number
  options?: MotionOptions
  shared?: readonly [
    Element | string | (() => Element | string | undefined),
    Element | string | (() => Element | string | undefined),
  ]
  guard?: Pick<MotionIntentLease, "signal" | "isCurrent" | "track">
}
export class MotionDriver {
  byIntent = new Map<number, Set<MotionControl>>()
  active = new Set<MotionControl>()
  runtime: ViewAnimationRuntime
  preference?: MotionPreferenceController
  unsub?: () => void
  constructor(
    o: {
      viewRuntime?: ViewAnimationRuntime
      preference?: MotionPreferenceController
    } = {},
  ) {
    this.runtime = o.viewRuntime ?? new BrowserRuntime()
    this.preference = o.preference
    // a level change lands every running animation at its end at once
    this.unsub = o.preference?.subscribe(() =>
      this.active.forEach((c) => c.finish()),
    )
  }
  level(): MotionLevel {
    return this.preference?.level() ?? "expressive"
  }
  track(c: Control, id?: number, g?: ViewAnimationSpec["guard"]) {
    this.active.add(c)
    g?.track(c)
    if (id !== undefined) {
      const s = this.byIntent.get(id) ?? new Set()
      s.add(c)
      this.byIntent.set(id, s)
      void c.finished.then(() => {
        s.delete(c)
        if (!s.size) this.byIntent.delete(id)
      })
    }
    void c.finished.then(() => this.active.delete(c))
  }
  /**
   * Animates `t` through `k`. The first keyframe is written at once, so
   * nothing shows its end state before the animation starts (an element just
   * created starts on the next frame, once it is in the document).
   */
  animate(t: Element, k: MotionKeyframes, o: MotionOptions, id?: number) {
    const c = new Control()
    this.track(c, id)
    const level = this.level()
    let run = k
    let options: MotionOptions = o
    if (level === "subtle") {
      run = "opacity" in k ? { opacity: k.opacity } : {}
      options = {
        duration: Math.min(o.duration, MotionTokens.options.reduced.duration),
        ease: "linear",
      }
      const rest = { ...k }
      delete rest.opacity
      // what fades out stays where it is: jumping to its exit position
      // (scale 0.95, off the edge) would be the movement reduced motion avoids
      if (last(k.opacity ?? 1) !== 0) setStyles(t, rest, last)
    }
    c.settle = () => setStyles(t, run, last)
    if (
      level === "off" ||
      !Object.keys(run).length ||
      typeof (t as HTMLElement).animate !== "function"
    ) {
      c.finish()
      return c
    }
    setStyles(t, run, first)
    const start = () => {
      if (c.state !== "running") return
      try {
        c.attach(
          animate(
            t,
            run as DOMKeyframesDefinition,
            options as AnimationOptions,
          ) as Native,
        )
      } catch (e) {
        if (!(e instanceof TypeError)) throw e
        c.finish()
      }
    }
    if (t.isConnected) start()
    else requestAnimationFrame(start)
    return c
  }
  async animateView(
    update: () => void | Promise<void>,
    s: ViewAnimationSpec = {},
  ) {
    const c = new Control()
    this.track(c, s.intentId, s.guard)
    const current = () =>
      !s.guard?.signal.aborted && (s.guard?.isCurrent() ?? true)
    const run = async () => {
      if (current()) await update()
    }
    if (
      this.level() === "off" ||
      (this.runtime instanceof BrowserRuntime &&
        typeof (document as any).startViewTransition !== "function")
    ) {
      await run()
      c.finish()
      return c
    }
    const resolve = (x: any) => (typeof x === "function" ? x() : x)
    const shared =
      this.level() === "expressive" && s.shared && current()
        ? ([resolve(s.shared[0]), resolve(s.shared[1])] as any)
        : undefined
    try {
      c.attach(
        await this.runtime.start(run, {
          options:
            this.level() === "subtle"
              ? MotionTokens.options.reduced
              : s.options,
          shared,
        }),
      )
      return c
    } catch (e) {
      c.cancel()
      throw e
    }
  }
  cancel(id: number) {
    this.byIntent.get(id)?.forEach((c) => c.cancel())
  }
  finish(id: number) {
    this.byIntent.get(id)?.forEach((c) => c.finish())
  }
  dispose() {
    this.unsub?.()
    this.active.forEach((c) => c.finish())
  }
}
