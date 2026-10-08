import { useColorMode } from "@hope-ui/solid"
import {
  createEffect,
  createSignal,
  lazy,
  type ParentProps,
  Show,
  onCleanup,
} from "solid-js"
import { useRouter } from "~/hooks"
import { me } from "~/store"
import { UserMethods } from "~/types"
import { isPaletteHotkey, paletteOpen, setPaletteOpen } from "../palette/state"
import { transfers } from "../transfers/service"
import { BottomTabs, TAB_BAR_HEIGHT } from "./BottomTabs"
import { readCollapsed, writeCollapsed } from "./nav-items"
import { FULL_WIDTH, RAIL_WIDTH, SideNav } from "./SideNav"
import { TOP_BAR_HEIGHT, TopBar } from "./TopBar"
import { createViewport } from "./viewport"

const TaskCenter = lazy(() => import("../transfers/TaskCenter"))
// Loaded on first use; the hotkey and the buttons only touch ../palette/state.
const CommandPalette = lazy(() => import("../palette/CommandPalette"))

/** Keep the Tailwind `dark` class on <html> in step with hope-ui's color mode. */
const useDarkClass = () => {
  const { colorMode } = useColorMode()
  createEffect(() => {
    document.documentElement.classList.toggle("dark", colorMode() === "dark")
  })
}

/**
 * Responsive frame around the existing pages: bottom tabs on phones, a rail on
 * tablets, a full (foldable) sidebar on desktops. The pages keep scrolling the
 * window; the nav is `position: fixed` and the content makes room with padding.
 * Guests get the bare page.
 */
const AppShell = (props: ParentProps) => {
  useDarkClass()
  const { pathname } = useRouter()
  const viewport = createViewport()
  const [folded, setFolded] = createSignal(readCollapsed(localStorage))
  const fold = () => {
    const next = !folded()
    setFolded(next)
    writeCollapsed(localStorage, next)
  }

  // me() is empty until the route's auth wrapper has loaded it.
  const shown = () => me().id !== undefined && !UserMethods.is_guest(me())
  const rail = () =>
    viewport() === "tablet" || (viewport() === "desktop" && folded())

  createEffect(() => {
    if (!shown()) return
    const stop = transfers.start()
    onCleanup(() => {
      stop()
      transfers.reset()
    })
  })

  // Ctrl/Cmd+K toggles the palette anywhere in the signed-in shell.
  createEffect(() => {
    if (!shown()) return
    const onKey = (e: KeyboardEvent) => {
      if (!isPaletteHotkey(e)) return
      e.preventDefault()
      setPaletteOpen(!paletteOpen())
    }
    window.addEventListener("keydown", onKey)
    onCleanup(() => window.removeEventListener("keydown", onKey))
  })
  const [paletteUsed, setPaletteUsed] = createSignal(false)
  createEffect(() => {
    if (paletteOpen()) setPaletteUsed(true)
  })

  const wide = () => shown() && viewport() !== "phone"
  const phone = () => shown() && viewport() === "phone"

  createEffect(() => {
    document.documentElement.classList.toggle("shell-phone", phone())
    onCleanup(() => document.documentElement.classList.remove("shell-phone"))
  })

  // The content wrapper is always rendered, so the page underneath is not
  // remounted when the nav appears once the user has loaded.
  return (
    <>
      <Show when={wide()}>
        <SideNav
          pathname={pathname()}
          rail={rail()}
          onToggle={viewport() === "desktop" ? fold : undefined}
        />
      </Show>
      <div
        data-shell-content
        class="w-full min-w-0 transition-[padding] duration-150"
        style={{
          "padding-left": wide() ? (rail() ? RAIL_WIDTH : FULL_WIDTH) : "0",
          "padding-bottom": phone()
            ? `calc(${TAB_BAR_HEIGHT} + env(safe-area-inset-bottom))`
            : "0",
          // Pages that size themselves to the viewport subtract this.
          "--shell-top": shown() ? TOP_BAR_HEIGHT : "0px",
        }}
      >
        <Show when={shown()}>
          <TopBar pathname={pathname()} phone={phone()} />
        </Show>
        {props.children}
      </div>
      <Show when={phone()}>
        <BottomTabs pathname={pathname()} />
      </Show>
      <Show when={shown() && paletteUsed()}>
        <CommandPalette />
      </Show>
      <Show when={wide()}>
        <TaskCenter />
      </Show>
    </>
  )
}

export default AppShell
