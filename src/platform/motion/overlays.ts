// How each kind of overlay comes in and leaves (research 02 §三): dialogs
// grow from 95% and fade, 200ms in and 150ms out; sheets slide in from their
// edge, 250/200; menus, dropdowns, popovers and tooltips grow from 95% at
// their anchor, 120/90; the scrim behind a dialog or sheet fades with it.
// Entering uses MD3's emphasized-decelerate curve, leaving its accelerate.
import type { MotionKeyframes } from "./MotionDriver"
import { MotionTokens, type MotionOptions } from "./MotionTokens"

export type OverlayKind =
  "dialog" | "sheet" | "menu" | "select" | "popover" | "tooltip"
export type SheetSide = "top" | "bottom" | "left" | "right"

export interface OverlayMotion {
  enter: readonly [MotionKeyframes, MotionOptions]
  exit: readonly [MotionKeyframes, MotionOptions]
}

const o = MotionTokens.options
// `at` is the resting transform written in the same function as `from`:
// motion turns a "none" keyframe into the type's zero (scale(0)), so a menu
// that should come to rest at full size shrank to nothing
const grow = (
  enter: MotionOptions,
  exit: MotionOptions,
  from = "scale(0.95)",
  at = "scale(1)",
): OverlayMotion => ({
  enter: [{ opacity: [0, 1], transform: [from, at] }, enter],
  // from where it is now: a close during the enter starts from there
  exit: [{ opacity: [null, 0], transform: [null, from] }, exit],
})
const offEdge: Record<SheetSide, [string, string]> = {
  top: ["translateY(-100%)", "translateY(0%)"],
  bottom: ["translateY(100%)", "translateY(0%)"],
  left: ["translateX(-100%)", "translateX(0%)"],
  right: ["translateX(100%)", "translateX(0%)"],
}

export const overlayMotion = (
  kind: OverlayKind,
  side: SheetSide = "right",
): OverlayMotion => {
  switch (kind) {
    case "dialog":
      return grow(o.dialogEnter, o.dialogExit)
    case "sheet":
      return grow(o.sheetEnter, o.sheetExit, ...offEdge[side])
    default:
      return grow(o.menuEnter, o.menuExit)
  }
}

/**
 * A bar that takes the place of another (the selection's actions over the
 * search box, the batch bar over the tab bar): it slides in from its edge and
 * fades, 200ms, and leaves the same way in 150ms (research 02 §三 选择条).
 */
export const barMotion = (from: "top" | "bottom"): OverlayMotion => {
  const off = from === "top" ? "translateY(-6px)" : "translateY(100%)"
  const at = from === "top" ? "translateY(0px)" : "translateY(0%)"
  return {
    enter: [{ opacity: [0, 1], transform: [off, at] }, o.barEnter],
    exit: [{ opacity: [null, 0], transform: [null, off] }, o.barExit],
  }
}

/** A toast: up from below and fading, 200ms in, 150ms out (as a bar). */
export const toastMotion: OverlayMotion = {
  enter: [
    { opacity: [0, 1], transform: ["translateY(8px)", "translateY(0px)"] },
    o.barEnter,
  ],
  exit: [
    { opacity: [null, 0], transform: [null, "translateY(8px)"] },
    o.barExit,
  ],
}

/** The scrim of a dialog or sheet: a fade on the same clock as its panel. */
export const scrimMotion = (kind: "dialog" | "sheet"): OverlayMotion => {
  const m = overlayMotion(kind)
  return {
    enter: [{ opacity: [0, 1] }, m.enter[1]],
    exit: [{ opacity: [null, 0] }, m.exit[1]],
  }
}
