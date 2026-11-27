// What the viewers share for their animations: boxes of elements, and one way
// to run a token's animation through platform/motion. With reduced motion asked
// for, the driver keeps only the opacity of an animation (MotionDriver.animate),
// so each animation here says how it fades as well: the viewers then come and
// go as a 100ms fade instead of not at all.
import { createRoot } from "solid-js"
import {
  motion,
  motionLevel,
  type MotionKeyframes,
  type MotionOptions,
} from "~/platform/motion"
import { createViewport } from "~/features/shell/viewport"

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

export const nextFrame = () =>
  new Promise<number>((r) => requestAnimationFrame(r))

/** Reduced motion: the viewers fade and nothing moves. */
export const reduced = () => motionLevel() !== "expressive"

/**
 * Runs `k` on `el`; `fade` is the opacity it has when reduced motion keeps
 * only a fade ([from, to]), left out when it already fades. Resolves when it
 * ends or is cut short.
 */
export const run = (
  el: Element,
  k: MotionKeyframes,
  options: MotionOptions,
  fade?: readonly [number, number],
) => {
  const keyframes =
    fade && !("opacity" in k) && reduced() ? { ...k, opacity: fade } : k
  return motion.animate(el, keyframes, options).finished
}

/** The shell's tiers (features/shell/viewport.ts), one for the viewers. */
const viewport = createRoot(() => createViewport())
export const isPhone = () => viewport() === "phone"

/** Where the page's top bar ends: fixed things of the viewers sit under it. */
export const shellTop = () => {
  const frame = document.querySelector("[data-shell-frame]")
  return frame
    ? parseFloat(getComputedStyle(frame).getPropertyValue("--shell-top")) || 0
    : 0
}
