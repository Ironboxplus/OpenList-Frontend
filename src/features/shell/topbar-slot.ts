// Pages put content into the shell's TopBar through these slots; the shell
// never imports page components (dependency direction: page -> shell).
import { createEffect, createSignal, onCleanup, type JSX } from "solid-js"

export interface SlotContext {
  phone: boolean
}

/** Height of the toolbar row under the top bar (wide shell). */
export const TOOLBAR_ROW_HEIGHT = "3.25rem"

export interface TopBarSlots {
  /** Replaces the default page title; sits left of the shell's search box. */
  left?: (ctx: SlotContext) => JSX.Element
  /** Sits left of the shell's own Task Center / account buttons. */
  right?: (ctx: SlotContext) => JSX.Element
  /**
   * A row on the canvas between the bar and the content card (the Files
   * breadcrumb with its view and sort buttons). On a phone it takes the place
   * of the bar's own row.
   */
  toolbar?: (ctx: SlotContext) => JSX.Element
  /** Hide the shell's search box, e.g. while the left slot shows a selection. */
  hideSearch?: boolean
}

interface Registered extends TopBarSlots {
  owner: number
}

const [current, setCurrent] = createSignal<Registered>()
let seq = 0

export const topBarSlots = (): TopBarSlots | undefined => current()

/**
 * Register slots for the lifetime of the calling component. A page that
 * mounts before the previous one has cleaned up still wins: cleanup only
 * clears what this call registered.
 */
export const useTopBarSlots = (get: () => TopBarSlots) => {
  const owner = ++seq
  createEffect(() => setCurrent({ owner, ...get() }))
  onCleanup(() => {
    if (current()?.owner === owner) setCurrent(undefined)
  })
}

/** True while the shell (TopBar, nav) is around the page; false for guests. */
export const [shellActive, setShellActive] = createSignal(false)

/** True while the signed-in shell is in its phone layout. */
export const [phoneShell, setPhoneShell] = createSignal(false)

export interface BottomBarOverride {
  /** While true the override replaces the bottom tab bar. */
  when: () => boolean
  render: () => JSX.Element
}

const [bottomBar, setBottomBar] = createSignal<
  BottomBarOverride & { owner: number }
>()
export const bottomBarOverride = (): BottomBarOverride | undefined =>
  bottomBar()

/** Let a page temporarily replace the phone tab bar (e.g. a selection bar). */
export const useBottomBar = (override: BottomBarOverride) => {
  const owner = ++seq
  setBottomBar({ owner, ...override })
  onCleanup(() => {
    if (bottomBar()?.owner === owner) setBottomBar(undefined)
  })
}
