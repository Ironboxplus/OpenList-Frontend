// The file browser's own motion (plan §P4, research 02 §三). Another folder
// or page fades through: a picture of what was there fades out (90ms), then
// the new content fades in (150ms), nothing moves. Another layout of the same
// folder cross-fades (150ms both). The rows of a listing in sight that come,
// go or change places do so one by one: a new row fades in (200ms) and is lit
// for 1200ms, a removed one fades out where it was (150ms), the others slide
// to their new places (250ms, standard).
import { createRoot, createEffect, on } from "solid-js"
import {
  motion,
  motionLevel,
  MotionTokens,
  type MotionControl,
  type MotionKeyframes,
  type MotionOptions,
} from "~/platform/motion"
import { objStore, State } from "~/store"
import { bus } from "~/utils/bus"

const O = MotionTokens.options

let live: HTMLElement | undefined
let ghost: HTMLElement | undefined
/** The fade through or cross-fade running, if any. */
let fades: MotionControl[] = []

/** The live content and the layer its pictures go in (FilesArea.tsx). */
export const bindFilesArea = (l: HTMLElement, g: HTMLElement) => {
  live = l
  ghost = g
}
export const unbindFilesArea = (l: HTMLElement) => {
  if (live !== l) return
  stopFades()
  live = ghost = undefined
}

/** Above this many elements no picture is taken: the new content only fades in. */
const MAX_PICTURE = 6000
/** Above this many rows in sight their changes are not animated. */
const MAX_ROWS = 200

/**
 * A copy that is only a picture: nothing in it can be found as a row, a test
 * id or a control, nothing plays, nothing takes focus (its layer is inert).
 */
const pictureOf = (el: HTMLElement) => {
  const copy = el.cloneNode(true) as HTMLElement
  copy
    .querySelectorAll("video, audio, iframe, movi-player, object, embed")
    .forEach((n) => n.remove())
  for (const n of [copy, ...copy.querySelectorAll<HTMLElement>("*")]) {
    for (const a of [...n.attributes])
      if (
        a.name === "id" ||
        a.name === "name" ||
        a.name === "data-testid" ||
        a.name === "data-motion" ||
        a.name.startsWith("data-row") ||
        a.name.startsWith("data-files") ||
        a.name.startsWith("data-action") ||
        a.name.startsWith("data-index")
      )
        n.removeAttribute(a.name)
    n.classList?.remove("viselect-item", "viselect-container")
  }
  return copy
}

const stopFades = () => {
  fades.forEach((c) => c.cancel())
  fades = []
}

/**
 * Before the listing is replaced: `through` for another folder or page,
 * `crossfade` for another layout of this one.
 */
export const fadeThrough = (kind: "through" | "crossfade") => {
  const l = live
  const g = ghost
  if (!l || !g || !l.isConnected) return
  stopFades()
  const [out, inn] =
    kind === "through"
      ? [O.throughOut, O.throughIn]
      : [O.crossfadeOut, O.crossfadeIn]
  const run: MotionControl[] = []
  if (l.getElementsByTagName("*").length <= MAX_PICTURE) {
    const pic = document.createElement("div")
    pic.setAttribute("data-motion", "files-ghost")
    pic.className = l.className
    pic.style.height = `${l.offsetHeight}px`
    pic.style.overflow = "hidden"
    for (const n of l.children) pic.appendChild(pictureOf(n as HTMLElement))
    g.appendChild(pic)
    const c = motion.animate(pic, { opacity: [1, 0] }, out)
    void c.finished.then(() => pic.remove())
    run.push(c)
  }
  const c = motion.animate(l, { opacity: [0, 1] }, inn)
  void c.finished.then(() => {
    // a newer fade has written its own start meanwhile
    if (fades.includes(c)) {
      l.style.removeProperty("opacity")
      fades = []
    }
  })
  run.push(c)
  fades = run
}

// ---- rows

/** Animations on one row: while any runs, its own transitions are off. */
const held = new WeakMap<HTMLElement, number>()
const play = (
  el: HTMLElement,
  k: MotionKeyframes,
  o: MotionOptions,
  name = "row",
) => {
  const n = held.get(el) ?? 0
  if (!n) {
    // the rows' own transitions (tailwind.css, !important) would also run on
    // the styles the animation writes, and again when they are taken away
    el.style.setProperty("transition", "none", "important")
    el.setAttribute("data-motion", name)
  }
  held.set(el, n + 1)
  const c = motion.animate(el, k, o)
  void c.finished.then(() => {
    for (const p of Object.keys(k))
      el.style.removeProperty(p.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`))
    const left = (held.get(el) ?? 1) - 1
    held.set(el, left)
    if (left) return
    // the end state is in place before the transitions come back
    void getComputedStyle(el).opacity
    el.style.removeProperty("transition")
    el.removeAttribute("data-motion")
  })
  return c
}

/**
 * A new row lit in the primary color, back to its own background. Written as
 * a browser color (color-mix), which WAAPI runs; the row's resting
 * background is read before the light takes its place (data-lit).
 */
const light = (el: HTMLElement) => {
  const root = getComputedStyle(document.documentElement)
  const primary = root.getPropertyValue("--primary").trim() || "#1976d2"
  const rest = getComputedStyle(el).backgroundColor
  el.setAttribute("data-lit", "")
  void play(
    el,
    {
      backgroundColor: [
        `color-mix(in srgb, ${primary} 18%, ${rest})`,
        `color-mix(in srgb, ${primary} 0%, ${rest})`,
      ],
    },
    O.highlight,
  ).finished.then(() => el.removeAttribute("data-lit"))
}

interface Before {
  rects: Map<string, DOMRect>
  rows: Map<string, HTMLElement>
}
let before: Before | undefined
/** When the listing in sight last became a folder (entered, not refreshed). */
let folderSince = 0
createRoot(() =>
  createEffect(
    on(
      () => objStore.state,
      (s) => {
        if (s === State.Folder) folderSince = performance.now()
      },
    ),
  ),
)
/** A folder just shown sorts itself once: that is not a change to show. */
const SETTLED = 300

const rowsOf = (root: HTMLElement) => {
  const m = new Map<string, HTMLElement>()
  root
    .querySelectorAll<HTMLElement>("[data-row-name]")
    .forEach((r) => m.set(r.dataset.rowName!, r))
  return m
}

/** Before the rows of the listing in sight change (store/obj.ts). */
export const beforeRows = () => {
  const l = live
  if (!l || !l.isConnected || before || fades.length) return
  if (motionLevel() === "off" || objStore.state !== State.Folder) return
  if (performance.now() - folderSince < SETTLED) return
  // a virtual list has only some of its rows in the document
  if (l.querySelector("[data-virtual-rows]")) return
  const rows = rowsOf(l)
  if (!rows.size || rows.size > MAX_ROWS) return
  const rects = new Map<string, DOMRect>()
  rows.forEach((r, name) => rects.set(name, r.getBoundingClientRect()))
  before = { rects, rows }
  // after every change of this turn (a listing, then its saved order)
  queueMicrotask(afterRows)
}

const afterRows = () => {
  const b = before
  before = undefined
  const l = live
  const g = ghost
  if (!b || !l || !g || !l.isConnected) return
  const now = rowsOf(l)
  if (now.size > MAX_ROWS) return
  const base = g.getBoundingClientRect()
  now.forEach((el, name) => {
    const was = b.rects.get(name)
    if (!was) {
      play(el, { opacity: [0, 1] }, O.itemIn)
      light(el)
      return
    }
    const r = el.getBoundingClientRect()
    const dx = was.left - r.left
    const dy = was.top - r.top
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return
    play(
      el,
      { transform: [`translate(${dx}px, ${dy}px)`, "translate(0px, 0px)"] },
      O.itemMove,
    )
  })
  b.rows.forEach((el, name) => {
    if (now.has(name)) return
    const was = b.rects.get(name)!
    const pic = pictureOf(el)
    pic.setAttribute("data-motion", "row-ghost")
    Object.assign(pic.style, {
      position: "absolute",
      margin: "0",
      left: `${was.left - base.left}px`,
      top: `${was.top - base.top}px`,
      width: `${was.width}px`,
      height: `${was.height}px`,
      transition: "none",
    })
    g.appendChild(pic)
    void motion
      .animate(pic, { opacity: [1, 0] }, O.itemOut)
      .finished.then(() => pic.remove())
  })
}

bus.on("files:before", (kind) =>
  kind === "layout" ? fadeThrough("crossfade") : beforeRows(),
)
