// Solid's side of the motion foundation: lifecycles only. What moves, how long
// and on which curve comes from the caller's tokens.
import { createEffect, on, onCleanup, splitProps, type JSX } from "solid-js"
import type { MotionControl, MotionKeyframes } from "./MotionDriver"
import type { MotionOptions } from "./MotionTokens"
import { motion } from "./runtime"

/** Plays `keyframes` once on `el` (a ring, an entrance); cancelled with its owner. */
export const playOnce = (
  el: HTMLElement,
  keyframes: MotionKeyframes,
  options: MotionOptions,
): MotionControl => {
  const c = motion.animate(el, keyframes, options)
  onCleanup(() => c.cancel())
  return c
}

/**
 * Keeps `el` moving to what `target` returns: from `initial` when it mounts,
 * then from where it is whenever the target changes.
 */
export const animateTo = (
  el: HTMLElement,
  target: () => Record<string, string | number>,
  options: MotionOptions,
  initial?: Record<string, string | number>,
) => {
  let run: MotionControl | undefined
  createEffect(
    on(target, (to) => {
      run?.cancel()
      const k: MotionKeyframes = {}
      for (const [p, v] of Object.entries(to))
        k[p] = run || !initial || !(p in initial) ? [null, v] : [initial[p], v]
      run = motion.animate(el, k, options)
    }),
  )
  onCleanup(() => run?.cancel())
}

export type MotionStyle = Record<string, string | number>

const px = (v: string | number) => (typeof v === "number" ? `${v}px` : v)
/**
 * `x`, `y` and `scale` become one `transform`, so the browser runs it as its
 * own animation (from and to always list all three, which keeps them
 * interpolable); other keys are CSS properties.
 */
export const toCss = (s: MotionStyle): MotionStyle => {
  const { x, y, scale, ...rest } = s
  if (x === undefined && y === undefined && scale === undefined) return rest
  return {
    ...rest,
    transform: `translate(${px(x ?? 0)}, ${px(y ?? 0)}) scale(${scale ?? 1})`,
  }
}

/**
 * A div that comes in from `initial` to `animate` when it mounts (and follows
 * `animate` when it changes). For elements of hope components: `as={MotionDiv}`.
 */
export const MotionDiv = (
  props: JSX.HTMLAttributes<HTMLDivElement> & {
    initial?: MotionStyle
    animate: MotionStyle
    transition: MotionOptions
    ref?: (el: HTMLDivElement) => void
  },
) => {
  const [local, rest] = splitProps(props, [
    "initial",
    "animate",
    "transition",
    "ref",
  ])
  return (
    <div
      ref={(el) => {
        animateTo(
          el,
          () => toCss(local.animate),
          local.transition,
          local.initial && toCss(local.initial),
        )
        local.ref?.(el)
      }}
      {...rest}
    />
  )
}
