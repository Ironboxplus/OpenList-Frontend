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

/** Per-item entrance delay for staggered lists, clamped so long lists stay snappy. */
export const staggerDelay = (index: number, step = 0.03, max = 0.3): number => {
  if (index <= 0) return 0
  return Math.min(index * step, max)
}

/** Fade + slight scale-up, the default item entrance. */
export const fadeScaleIn: MotionPreset = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  transition: { duration: 0.2 },
}

/** Staggered variant of {@link fadeScaleIn} for list/grid items. */
export const listItemIn = (index: number): MotionPreset => ({
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  transition: { duration: 0.2, delay: staggerDelay(index) },
})

/** Page/route-level transition used when switching directories. */
export const pageTransition: MotionPreset = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.18 },
}
