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
