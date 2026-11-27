// Entry of the motion foundation (docs/PLAN_FE_SYSTEM_UX_1127.md §0.2 动效库).
export { motion, motionLevel, motionPreference } from "./runtime"
export { MotionTokens, cssVariableOf } from "./MotionTokens"
export type { MotionOptions } from "./MotionTokens"
export type { MotionControl, MotionKeyframes } from "./MotionDriver"
export type { MotionLevel } from "./ReducedMotion"
export { createPresence, type Presence, type PartMotion } from "./presence"
export {
  barMotion,
  overlayMotion,
  scrimMotion,
  toastMotion,
  type OverlayKind,
  type SheetSide,
} from "./overlays"
export { MotionDiv, MotionShow, animateTo, playOnce } from "./solid"
export { revealFrom } from "./reveal"
export { countTo } from "./count"
