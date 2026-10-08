import { Accessor, createSignal, onCleanup } from "solid-js"

export type Viewport = "phone" | "tablet" | "desktop"

export const PHONE_MAX = 640
export const TABLET_MAX = 1024

export const viewportFor = (width: number): Viewport =>
  width < PHONE_MAX ? "phone" : width < TABLET_MAX ? "tablet" : "desktop"

/** Tracks the three layout tiers with the same breakpoints Tailwind uses. */
export const createViewport = (): Accessor<Viewport> => {
  const [vp, setVp] = createSignal<Viewport>(viewportFor(window.innerWidth))
  if (typeof window.matchMedia === "function") {
    const sm = window.matchMedia(`(min-width: ${PHONE_MAX}px)`)
    const lg = window.matchMedia(`(min-width: ${TABLET_MAX}px)`)
    const update = () =>
      setVp(lg.matches ? "desktop" : sm.matches ? "tablet" : "phone")
    update()
    sm.addEventListener("change", update)
    lg.addEventListener("change", update)
    onCleanup(() => {
      sm.removeEventListener("change", update)
      lg.removeEventListener("change", update)
    })
  }
  return vp
}

export const TAB_BAR_HEIGHT = "3.5rem"
