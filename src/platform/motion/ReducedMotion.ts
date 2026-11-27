export type MotionLevel = "off" | "subtle" | "expressive"
export type MotionPreference = MotionLevel | "system"
export interface MediaQuerySource {
  readonly matches: boolean
  addChangeListener(listener: () => void): () => void
}
export interface MotionPreferenceController {
  level(): MotionLevel
  set(p: MotionPreference): void
  subscribe(fn: (level: MotionLevel) => void): () => void
  dispose(): void
}
export function createMotionPreference(
  options: {
    initial?: MotionPreference
    media?: MediaQuerySource
    window?: Window
  } = {},
): MotionPreferenceController {
  const native =
    options.window ?? (typeof window === "undefined" ? undefined : window)
  const mql = native?.matchMedia?.("(prefers-reduced-motion: reduce)")
  const media =
    options.media ??
    (mql
      ? {
          get matches() {
            return mql.matches
          },
          addChangeListener(fn: () => void) {
            mql.addEventListener("change", fn)
            return () => mql.removeEventListener("change", fn)
          },
        }
      : undefined)
  let pref = options.initial ?? "system"
  const listeners = new Set<(l: MotionLevel) => void>()
  const level = () =>
    pref === "system" ? (media?.matches ? "subtle" : "expressive") : pref
  const notify = () => listeners.forEach((fn) => fn(level()))
  const remove = media?.addChangeListener(() => {
    if (pref === "system") notify()
  })
  return {
    level,
    set(next) {
      if (pref !== next) {
        pref = next
        notify()
      }
    },
    subscribe(fn) {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    dispose() {
      remove?.()
      listeners.clear()
    },
  }
}
