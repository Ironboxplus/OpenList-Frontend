/**
 * Shared solid-motionone animation presets so motion is consistent and tunable
 * from one place. Values are plain objects spread onto `<Motion.div>`.
 */

export interface MotionTransition {
  duration?: number
  delay?: number
  easing?: string | number[]
}

export interface MotionPreset {
  initial: Record<string, number>
  animate: Record<string, number>
  exit?: Record<string, number>
  transition: MotionTransition
}

/** Fade + slight scale-up, the default item entrance. */
export const fadeScaleIn: MotionPreset = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  transition: { duration: 0.2 },
}

/** Page/route-level transition used when switching directories. */
export const pageTransition: MotionPreset = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.18 },
}

/** Reduced motion is asked for: skip decorative animation, keep the information. */
export const prefersReducedMotion = (): boolean =>
  typeof window !== "undefined" &&
  !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches

/**
 * A section's content comes in with a short fade and rise. There is no exit:
 * the old section stays until the new one is ready and is then replaced.
 */
export const sectionEnter: MotionPreset = {
  initial: { opacity: 0.001, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.16 },
}

/** The sliding highlight of the side nav. */
export const navIndicatorMove: MotionTransition = {
  duration: 0.16,
  easing: [0.4, 0, 0.2, 1],
}

/**
 * Props to spread onto `<Motion.div>`. With reduced motion asked for they are
 * empty: the element just shows its final state.
 */
export const motionProps = (preset: MotionPreset): Partial<MotionPreset> =>
  prefersReducedMotion() ? {} : preset

/** motionone's option types are stricter than our plain presets; spread through this. */
export const asMotion = (p: object): any => p

/** A transition that takes no time when reduced motion is asked for. */
export const motionTransition = (t: MotionTransition): MotionTransition =>
  prefersReducedMotion() ? { duration: 0 } : t

/** One soft ring that grows and fades once: draws the eye to a button without moving it. */
export const attentionRing: MotionPreset = {
  initial: { opacity: 0.7, scale: 0.9 },
  animate: { opacity: 0, scale: 1.7 },
  transition: { duration: 0.9 },
}
