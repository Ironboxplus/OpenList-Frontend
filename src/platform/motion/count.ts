// A number counting from one value to another (a figure on the dashboard),
// on Motion's clock. Only the expressive level counts; otherwise the new
// value shows at once (a figure that runs is movement too).
import { animate } from "motion"
import type { MotionOptions } from "./MotionTokens"
import { motionLevel } from "./runtime"

/** Calls `step` with each value on the way and `done` at the end; returns a stop. */
export const countTo = (
  from: number,
  to: number,
  step: (v: number) => void,
  o: MotionOptions,
  done: () => void,
): (() => void) => {
  if (motionLevel() !== "expressive" || from === to) {
    done()
    return () => {}
  }
  const run = animate(from, to, {
    duration: o.duration,
    ease:
      o.ease === "linear"
        ? "linear"
        : ([...o.ease] as [number, number, number, number]),
    onUpdate: step,
    onComplete: done,
  })
  return () => run.stop()
}
