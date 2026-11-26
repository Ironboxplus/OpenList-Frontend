/** Width of the full side nav, which the user can drag wider (PLAN_FE_SHELL_FIXES_1126 §2.6). */
export const NAV_WIDTH_KEY = "shell-nav-width"
/** The default, and the narrowest the nav gets. */
export const NAV_MIN = 220
/** What the content card keeps at least beside the widest nav. */
export const MAIN_MIN = 480
/** One arrow key press on the handle. */
export const NAV_STEP = 16

/** The widest the nav may be in a window this wide: half of it, and room for the content. */
export const navMax = (viewport: number) =>
  Math.max(NAV_MIN, Math.min(Math.floor(viewport / 2), viewport - MAIN_MIN))

export const clampNavWidth = (w: number, max: number) =>
  Math.round(Math.min(Math.max(w, NAV_MIN), max))

type KV = Pick<Storage, "getItem" | "setItem">

export const readNavWidth = (s: KV): number => {
  try {
    const v = Number(s.getItem(NAV_WIDTH_KEY))
    return Number.isFinite(v) && v >= NAV_MIN ? v : NAV_MIN
  } catch {
    return NAV_MIN
  }
}

export const writeNavWidth = (s: KV, w: number) => {
  try {
    s.setItem(NAV_WIDTH_KEY, String(w))
  } catch {
    // storage unavailable: the width just doesn't persist
  }
}
