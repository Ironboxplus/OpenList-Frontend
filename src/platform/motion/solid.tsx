// Solid's side of the motion foundation: lifecycles only. What moves, how long
// and on which curve comes from the caller's tokens.
import {
  createEffect,
  on,
  onCleanup,
  Show,
  splitProps,
  type JSX,
} from "solid-js"
import type { MotionControl, MotionKeyframes } from "./MotionDriver"
import type { MotionOptions } from "./MotionTokens"
import { createPresence, type PartMotion } from "./presence"
import { motion } from "./runtime"

const FLOAT = ["position", "left", "top", "width", "height", "margin"]
/** Out of the flow where it is, so what takes its place does not wait for it. */
const floatOut = (el: HTMLElement) => {
  const s = el.style
  s.setProperty("position", "absolute")
  s.setProperty("left", `${el.offsetLeft}px`)
  s.setProperty("top", `${el.offsetTop}px`)
  s.setProperty("width", `${el.offsetWidth}px`)
  s.setProperty("height", `${el.offsetHeight}px`)
  s.setProperty("margin", "0")
}
const floatIn = (el: HTMLElement) =>
  FLOAT.forEach((p) => el.style.removeProperty(p))

/**
 * Children that come into sight and leave it with `motion`: kept mounted
 * through the exit (createPresence). `float`: leaving, the box is taken out of
 * the flow at once (its parent must be positioned), for something that gives
 * its place to another. `name` is its data-motion.
 */
export const MotionShow = (props: {
  when: boolean
  motion: Pick<PartMotion, "enter" | "exit">
  name: string
  float?: boolean
  class?: string
  children: JSX.Element
}) => {
  const p = createPresence(() => props.when)
  return (
    <Show when={p.present()}>
      <div
        ref={p.part({
          ...props.motion,
          leaving: props.float ? floatOut : undefined,
          entering: props.float ? floatIn : undefined,
        })}
        data-motion={props.name}
        class={props.class}
      >
        {props.children}
      </div>
    </Show>
  )
}

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
    /** Duration and curve (not `transition`: hope's Box takes that as CSS). */
    timing: MotionOptions
    ref?: (el: HTMLDivElement) => void
  },
) => {
  const [local, rest] = splitProps(props, [
    "initial",
    "animate",
    "timing",
    "ref",
  ])
  return (
    <div
      ref={(el) => {
        animateTo(
          el,
          () => toCss(local.animate),
          local.timing,
          local.initial && toCss(local.initial),
        )
        local.ref?.(el)
      }}
      {...rest}
    />
  )
}
