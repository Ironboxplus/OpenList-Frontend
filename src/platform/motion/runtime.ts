// The app's motion runtime: one preference (the system's reduced-motion
// setting) and one driver every animation goes through.
import { createRoot, createSignal } from "solid-js"
import { MotionDriver } from "./MotionDriver"
import { createMotionPreference, type MotionLevel } from "./ReducedMotion"

export const motionPreference = createMotionPreference()
export const motion = new MotionDriver({ preference: motionPreference })

/** The current level as a signal (expressive; subtle when reduced motion is asked for; off). */
export const motionLevel = createRoot(() => {
  const [level, setLevel] = createSignal<MotionLevel>(motionPreference.level())
  motionPreference.subscribe(setLevel)
  return level
})
