// Pages put content into the shell's TopBar through these slots; the shell
// never imports page components (dependency direction: page -> shell).
import { createEffect, createSignal, onCleanup, type JSX } from "solid-js"

export interface SlotContext {
  phone: boolean
}

export interface TopBarSlots {
  /** Replaces the default page title. */
  left?: (ctx: SlotContext) => JSX.Element
  /** Sits left of the shell's own search / Task Center buttons. */
  right?: (ctx: SlotContext) => JSX.Element
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
