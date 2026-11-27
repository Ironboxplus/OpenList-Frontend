// A change to the whole page that spreads from where it was asked for: the new
// page as a circle growing from the middle of `from` over the old one (a view
// transition). Switching light and dark does this (plan §P4, research 02 §三:
// 200ms, standard); from the middle of the window when there is no button
// (the command palette). Reduced motion changes it at once.
import { MotionTokens } from "./MotionTokens"
import { motion, motionLevel } from "./runtime"

export const revealFrom = (update: () => void, from?: Element | null) => {
  if (
    motionLevel() !== "expressive" ||
    typeof document.startViewTransition !== "function"
  ) {
    update()
    return
  }
  const r = from?.getBoundingClientRect()
  const w = window.innerWidth
  const h = window.innerHeight
  const x = Math.round(r ? r.left + r.width / 2 : w / 2)
  const y = Math.round(r ? r.top + r.height / 2 : h / 2)
  // to the farthest corner
  const end = Math.ceil(Math.hypot(Math.max(x, w - x), Math.max(y, h - y)))
  const at = `at ${x}px ${y}px`
  void motion
    .animateView(update, {
      options: MotionTokens.options.theme,
      layers: {
        new: { clipPath: [`circle(0px ${at})`, `circle(${end}px ${at})`] },
        // the old page stays under the circle, it does not fade
        old: { opacity: [1, 1] },
      },
    })
    .catch((e) => console.warn("reveal", e))
}
