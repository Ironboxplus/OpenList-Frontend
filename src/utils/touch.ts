import { isMobile } from "./compatibility"

/**
 * True when the primary pointer cannot hover (touch screens, most phones/tablets).
 * Hover-only affordances (e.g. tooltips) are invisible on these devices, so we
 * use this to decide when to surface labels inline instead.
 */
export const hasCoarsePointer = (): boolean => {
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return false
  }
  return window.matchMedia("(hover: none), (pointer: coarse)").matches
}

/**
 * Best-effort detection of a touch-first device. Combines the CSS pointer media
 * query, the touch-points hint, and the UA-based `isMobile` fallback so that a
 * positive signal from any source is enough.
 */
export const isTouchDevice = (): boolean => {
  if (hasCoarsePointer()) return true
  if (
    typeof navigator !== "undefined" &&
    typeof navigator.maxTouchPoints === "number" &&
    navigator.maxTouchPoints > 0
  ) {
    return true
  }
  return isMobile
}

export const LONG_PRESS_MS = 500
/** Finger travel (px) that turns a press into a scroll, cancelling the long press. */
export const LONG_PRESS_SLOP = 8

/**
 * Long-press detection from pointer events. `onLongPress` fires once after
 * `LONG_PRESS_MS` of holding still; `consumeClick()` then reports (once) that
 * the click which follows the release came from that press and must be ignored.
 */
export const createLongPress = (
  onLongPress: (e: PointerEvent) => void,
  ms = LONG_PRESS_MS,
) => {
  let timer: ReturnType<typeof setTimeout> | undefined
  let startX = 0
  let startY = 0
  let fired = false
  const cancel = () => {
    if (timer !== undefined) clearTimeout(timer)
    timer = undefined
  }
  return {
    onPointerDown(e: PointerEvent) {
      if (e.pointerType === "mouse" && e.button !== 0) return
      cancel()
      fired = false
      startX = e.clientX
      startY = e.clientY
      timer = setTimeout(() => {
        timer = undefined
        fired = true
        onLongPress(e)
      }, ms)
    },
    onPointerMove(e: PointerEvent) {
      if (timer === undefined) return
      if (Math.hypot(e.clientX - startX, e.clientY - startY) > LONG_PRESS_SLOP)
        cancel()
    },
    onPointerEnd: cancel,
    /** True once after a long press, so the trailing click can be swallowed. */
    consumeClick() {
      const was = fired
      fired = false
      return was
    },
  }
}
