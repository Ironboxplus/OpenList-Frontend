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
  // P4 (research 02 §三): entering a folder fades through (the old content
  // out in 90ms, then the new in in 150ms, nothing moves); two layouts of one
  // folder cross-fade in 150ms
  throughOut: 90,
  throughIn: 150,
  crossfade: 150,
  /** A row that came: it fades in, and is lit for `highlight`. */
  itemIn: 200,
  /** A row that went: it fades out where it was. */
  itemOut: 150,
  /** Rows sliding to their new places (a removal above, a new order). */
  itemMove: 250,
  highlight: 1200,
  /** An icon turning into another (copy -> check). */
  iconSwap: 100,
  /** A progress bar running to its new value. */
  progress: 200,
  /** The layer that says where dragged-in files will go. */
  dragHint: 100,
  /** The new theme spreading over the page. */
  theme: 200,
  /** A figure counting to its new value (my choice: MD3 "medium" is 250-400). */
  count: 300,
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
    viewerEnter: tween(duration.viewerOpen, curves.emphasizedDecel),
    viewerExit: tween(duration.viewerClose, curves.emphasizedAccel),
    viewerSheet: tween(duration.viewerSheet, curves.emphasizedDecel),
    viewerSwitch: tween(duration.viewerSwitch, curves.standard),
    scrim: tween(duration.scrim, curves.standard),
    dockEnter: tween(duration.dockOpen, curves.emphasizedDecel),
    dockExit: tween(duration.dockClose, curves.emphasizedAccel),
    dockMini: tween(duration.dockMini, curves.standard),
    pane: tween(duration.pane, curves.standard),
    section: tween(duration.section, curves.standard),
    attention: tween(duration.attention, curves.standard),
    throughOut: tween(duration.throughOut, curves.emphasizedAccel),
    throughIn: {
      ...tween(duration.throughIn, curves.emphasizedDecel),
      delay: duration.throughOut / 1000,
    },
    crossfadeOut: tween(duration.crossfade, curves.emphasizedAccel),
    crossfadeIn: tween(duration.crossfade, curves.emphasizedDecel),
    itemIn: tween(duration.itemIn, curves.emphasizedDecel),
    itemOut: tween(duration.itemOut, curves.emphasizedAccel),
    itemMove: tween(duration.itemMove, curves.standard),
    highlight: tween(duration.highlight, curves.standard),
    iconSwap: tween(duration.iconSwap, curves.standard),
    progress: tween(duration.progress, curves.standard),
    dragHint: tween(duration.dragHint, curves.standard),
    theme: tween(duration.theme, curves.standard),
    count: tween(duration.count, curves.standard),
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
