// Mount and unmount of an animated overlay. Kobalte's own presence waits for
// CSS animations only; ours waits for the Motion animations of every part
// (panel, scrim). The component renders its parts while `present()` and hands
// each its `part()` ref: a part that mounts while open plays its enter; when
// `open` turns false every part plays its exit and only once all of them have
// finished is `present` false, so the subtree leaves the DOM after its exit.
// Opened again during the exit, each part turns round from where it is.
import { createSignal, onCleanup, untrack, type Accessor } from "solid-js"
import { createEffect, on } from "solid-js"
import type { MotionControl, MotionKeyframes } from "./MotionDriver"
import type { MotionOptions } from "./MotionTokens"
import { motion } from "./runtime"

export interface PartMotion {
  enter: readonly [MotionKeyframes, MotionOptions]
  exit: readonly [MotionKeyframes, MotionOptions]
  /** Called as the exit starts (to take the part out of the flow, say). */
  leaving?: (el: HTMLElement) => void
  /** Called as an enter starts, also turning round mid-exit. */
  entering?: (el: HTMLElement) => void
}

export interface Presence {
  /** Render the overlay's subtree while this is true. */
  present: Accessor<boolean>
  /** The ref of one animated part. */
  part: (m: PartMotion) => (el: HTMLElement) => void
}

/** Starts of the enter keyframes where the part is now: turning round mid-exit. */
const fromHere = (k: MotionKeyframes): MotionKeyframes =>
  Object.fromEntries(
    Object.entries(k).map(([p, v]) => [
      p,
      Array.isArray(v) ? [null, ...v.slice(1)] : v,
    ]),
  )

/** A transform that leaves the element where it is. */
const IDENTITY = /^(none|scale\(1\)|translate[XY]?\(0(%|px)?\))$/
/**
 * Once in place, an identity transform is dropped: kept inline it would make
 * the overlay the containing block of its fixed descendants.
 */
const restAt = (el: HTMLElement, k: MotionKeyframes) => {
  const t = k.transform
  const end = Array.isArray(t) ? t[t.length - 1] : t
  if (typeof end === "string" && IDENTITY.test(end))
    el.style.removeProperty("transform")
}

export function createPresence(open: Accessor<boolean>): Presence {
  const [present, setPresent] = createSignal(untrack(open))
  const parts = new Map<
    HTMLElement,
    { m: PartMotion; run?: MotionControl; leaving?: boolean }
  >()
  let exiting = 0

  const enter = (el: HTMLElement, turning: boolean) => {
    const p = parts.get(el)
    if (!p) return
    p.run?.cancel()
    p.leaving = false
    el.style.removeProperty("pointer-events")
    p.m.entering?.(el)
    const [k, o] = p.m.enter
    const run = motion.animate(el, turning ? fromHere(k) : k, o)
    p.run = run
    void run.finished.then(() => {
      if (p.run === run && run.state === "finished") restAt(el, k)
    })
  }

  const leave = () => {
    const round = ++exiting
    const runs = [...parts.entries()].map(([el, p]) => {
      p.run?.cancel()
      p.leaving = true
      // a closing overlay takes no clicks
      el.style.setProperty("pointer-events", "none")
      p.m.leaving?.(el)
      p.run = motion.animate(el, p.m.exit[0], p.m.exit[1])
      return p.run.finished
    })
    void Promise.all(runs).then(() => {
      if (round === exiting && !untrack(open)) setPresent(false)
    })
  }

  createEffect(
    on(
      open,
      (now) => {
        if (now) {
          exiting++
          if (!present()) setPresent(true)
          // parts still mounted are turning round mid-exit; new ones enter as they mount
          else parts.forEach((p, el) => p.leaving && enter(el, true))
        } else if (present()) leave()
      },
      { defer: true },
    ),
  )

  return {
    present,
    part: (m) => (el) => {
      parts.set(el, { m })
      onCleanup(() => {
        parts.get(el)?.run?.cancel()
        parts.delete(el)
      })
      if (untrack(open)) enter(el, false)
    },
  }
}
