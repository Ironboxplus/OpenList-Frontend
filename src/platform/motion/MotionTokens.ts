// Durations and curves of every animation in the app. This file is the one
// source: tokens.css carries the same values as --motion-* variables for
// styles (a test keeps the two equal), and the scripted animations take their
// options from here. Values: tmp/ui-motion-research/02 §一 (MD3 curves), §三
// (dialog 200/150, sheet 250/200, menu 120/90, viewer 320/240, bars 200/150),
// 03 §三 (docked player 500/200), 05 §二.3 (advanced section 220/180, the fade
// 40ms ahead of the height).

export type CubicBezier = readonly [number, number, number, number]

const curves = {
  /** MD3 emphasized-decelerate: things that come in. */
  emphasizedDecel: [0.05, 0.7, 0.1, 1],
  /** MD3 emphasized-accelerate: things that leave. */
  emphasizedAccel: [0.3, 0, 0.8, 0.15],
  /** MD3 standard: things that move within the page. */
  standard: [0.2, 0, 0, 1],
} as const satisfies Record<string, CubicBezier>

/** Milliseconds. The CSS variable of `dialogOpen` is --motion-dialog-open. */
const duration = {
  dialogOpen: 200,
  dialogClose: 150,
  sheetOpen: 250,
  sheetClose: 200,
  menuOpen: 120,
  menuClose: 90,
  collapseOpen: 220,
  collapseClose: 180,
  collapseLead: 40,
  viewerOpen: 320,
  viewerClose: 240,
  viewerSheet: 350,
  viewerSwitch: 220,
  scrim: 200,
  dockOpen: 500,
  dockClose: 200,
  dockMini: 250,
  barOpen: 200,
  barClose: 150,
  /** A panel sliding in from an edge (hover-revealed tree, table of contents). */
  pane: 220,
  /** A new section of the app coming in. */
  section: 160,
  /** A one-off ring that draws the eye to a button. */
  attention: 900,
  /** The longest any animation runs while reduced motion is asked for. */
  reduced: 100,
  /** An intent nobody finished is cleaned up after this. */
  watchdog: 2000,
} as const

/** Options for the `motion` library: seconds and a cubic-bezier array. */
export interface MotionOptions {
  duration: number
  ease: CubicBezier | "linear"
  delay?: number
}

const tween = (ms: number, ease: CubicBezier | "linear"): MotionOptions => ({
  duration: ms / 1000,
  ease,
})

export const MotionTokens = {
  duration,
  ease: curves,
  options: {
    dialogEnter: tween(duration.dialogOpen, curves.emphasizedDecel),
    dialogExit: tween(duration.dialogClose, curves.emphasizedAccel),
    sheetEnter: tween(duration.sheetOpen, curves.emphasizedDecel),
    sheetExit: tween(duration.sheetClose, curves.emphasizedAccel),
    menuEnter: tween(duration.menuOpen, curves.emphasizedDecel),
    menuExit: tween(duration.menuClose, curves.emphasizedAccel),
    collapseEnter: tween(duration.collapseOpen, curves.emphasizedDecel),
    collapseExit: tween(duration.collapseClose, curves.emphasizedAccel),
    barEnter: tween(duration.barOpen, curves.emphasizedDecel),
    barExit: tween(duration.barClose, curves.emphasizedAccel),
    pane: tween(duration.pane, curves.standard),
    section: tween(duration.section, curves.standard),
    attention: tween(duration.attention, curves.standard),
    reduced: tween(duration.reduced, "linear"),
  },
  spring: {
    snappy: { type: "spring", visualDuration: 0.24, bounce: 0.18 },
    standard: { type: "spring", visualDuration: 0.32, bounce: 0.12 },
    gentle: { type: "spring", visualDuration: 0.4, bounce: 0.04 },
  },
} as const

/** "dialogOpen" -> "--motion-dialog-open" */
export const cssVariableOf = (name: string) =>
  `--motion-${name.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}`
