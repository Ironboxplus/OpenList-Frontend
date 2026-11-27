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
const grow = (
  enter: MotionOptions,
  exit: MotionOptions,
  from = "scale(0.95)",
): OverlayMotion => ({
  enter: [{ opacity: [0, 1], transform: [from, "none"] }, enter],
  // from where it is now: a close during the enter starts from there
  exit: [{ opacity: [null, 0], transform: [null, from] }, exit],
})
const offEdge: Record<SheetSide, string> = {
  top: "translateY(-100%)",
  bottom: "translateY(100%)",
  left: "translateX(-100%)",
  right: "translateX(100%)",
}

export const overlayMotion = (
  kind: OverlayKind,
  side: SheetSide = "right",
): OverlayMotion => {
  switch (kind) {
    case "dialog":
      return grow(o.dialogEnter, o.dialogExit)
    case "sheet":
      return grow(o.sheetEnter, o.sheetExit, offEdge[side])
    default:
      return grow(o.menuEnter, o.menuExit)
  }
}

/** The scrim of a dialog or sheet: a fade on the same clock as its panel. */
export const scrimMotion = (kind: "dialog" | "sheet"): OverlayMotion => {
  const m = overlayMotion(kind)
  return {
    enter: [{ opacity: [0, 1] }, m.enter[1]],
    exit: [{ opacity: [null, 0] }, m.exit[1]],
  }
}
