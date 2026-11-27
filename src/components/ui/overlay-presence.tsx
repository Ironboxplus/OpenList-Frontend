import { Show, type Accessor, type JSX } from "solid-js"
import {
  createPresence,
  overlayMotion,
  type OverlayKind,
  type PartMotion,
} from "~/platform/motion"

/** Appears and leaves at once. */
const STILL: PartMotion = {
  enter: [{}, { duration: 0, ease: "linear" }],
  exit: [{}, { duration: 0, ease: "linear" }],
}

/** Calls the moving part's ref and the caller's. */
export const withRef =
  <E extends HTMLElement>(own: (el: E) => void, theirs: unknown) =>
  (el: E) => {
    own(el)
    if (typeof theirs === "function") (theirs as (el: E) => void)(el)
  }

/**
 * The portal of an anchored overlay (menu, submenu, dropdown, popover,
 * tooltip): mounted while `open` and through its Motion exit. Its root is
 * given forceMount so Kobalte does not unmount it first; `children` gets the
 * ref of the element that moves.
 */
export const OverlayPresence = (props: {
  open: Accessor<boolean>
  kind: OverlayKind
  /** No enter or exit animation (hope's motionPreset="none"). */
  still?: boolean
  children: (ref: (el: HTMLElement) => void) => JSX.Element
}) => {
  const p = createPresence(() => props.open())
  return (
    <Show when={p.present()}>
      {props.children(p.part(props.still ? STILL : overlayMotion(props.kind)))}
    </Show>
  )
}
