// Scripted motion of the prototype: the durations and curves come from the CSS
// tokens (motion.css), so the reduced-motion media query changes them in one
// place. Every animation that runs is written to window.__motion with what was
// asked for and how long it actually took, for the CI report.

export type MotionToken =
  | "viewer-open"
  | "viewer-close"
  | "viewer-sheet"
  | "viewer-switch"
  | "scrim"
  | "dock-open"
  | "dock-close"
  | "dock-mini"
  | "bar-open"
  | "bar-close"

export type Curve = "emphasized-decel" | "emphasized-accel" | "standard"

const css = (name: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim()

/** A duration token in milliseconds. */
export const ms = (token: MotionToken): number => {
  const v = css(`--motion-${token}`)
  return v.endsWith("ms") ? parseFloat(v) : parseFloat(v) * 1000
}

export const curve = (c: Curve): string => css(`--motion-${c}`)

export const reducedMotion = (): boolean =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches

export interface MotionRecord {
  name: string
  duration: number
  easing: string
  /** From the start of the animation to its `finished`, in ms. */
  measured?: number
  reduced: boolean
  cancelled?: boolean
}

declare global {
  interface Window {
    __motion: MotionRecord[]
  }
}

/**
 * One WAAPI animation, logged. Resolves when it ends, also when it is
 * cancelled (a newer animation of the same element replaced it).
 */
export const run = (
  name: string,
  el: Element,
  keyframes: Keyframe[],
  token: MotionToken,
  c: Curve,
  extra: KeyframeAnimationOptions = {},
): Promise<void> => {
  const duration = ms(token)
  const easing = curve(c)
  const rec: MotionRecord = { name, duration, easing, reduced: reducedMotion() }
  window.__motion.push(rec)
  const t0 = performance.now()
  const a = el.animate(keyframes, { duration, easing, ...extra })
  return a.finished.then(
    () => {
      rec.measured = Math.round(performance.now() - t0)
    },
    () => {
      rec.cancelled = true
    },
  )
}

/**
 * CSS animations and transitions (Kobalte content, tw-animate-css enter/exit,
 * the collapsible) are logged from their events, with the duration the
 * stylesheet gave them.
 */
export const installMotionLog = () => {
  window.__motion = []
  const starts = new WeakMap<Element, Map<string, number>>()
  document.addEventListener(
    "animationstart",
    (e) => {
      const el = e.target as Element
      const m = starts.get(el) ?? new Map<string, number>()
      m.set(e.animationName, performance.now())
      starts.set(el, m)
    },
    true,
  )
  document.addEventListener(
    "animationend",
    (e) => {
      const el = e.target as HTMLElement
      const t0 = starts.get(el)?.get(e.animationName)
      if (t0 === undefined) return
      const cs = getComputedStyle(el)
      window.__motion.push({
        name: `css:${e.animationName}${el.dataset.motion ? ` (${el.dataset.motion})` : ""}`,
        duration: Math.round(parseFloat(cs.animationDuration) * 1000),
        easing: cs.animationTimingFunction,
        measured: Math.round(performance.now() - t0),
        reduced: reducedMotion(),
      })
    },
    true,
  )
}

export interface Box {
  left: number
  top: number
  width: number
  height: number
}

export const boxOf = (el: Element): Box => {
  const r = el.getBoundingClientRect()
  return { left: r.left, top: r.top, width: r.width, height: r.height }
}

/** Whether a box is on screen at all (an origin row scrolled away is not). */
export const visible = (b: Box | undefined): b is Box =>
  !!b &&
  b.width > 0 &&
  b.height > 0 &&
  b.top + b.height > 0 &&
  b.top < window.innerHeight &&
  b.left + b.width > 0 &&
  b.left < window.innerWidth
