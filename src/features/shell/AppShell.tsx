import { useColorMode } from "@hope-ui/solid"
import {
  createEffect,
  createMemo,
  createSignal,
  lazy,
  type ParentProps,
  Show,
  Suspense,
  onCleanup,
} from "solid-js"
import { Motion } from "solid-motionone"
import { FullLoading } from "~/components"
import { useRouter } from "~/hooks"
import { me } from "~/store"
import { asMotion, motionProps, sectionEnter } from "~/utils/motion-presets"
import { UserMethods } from "~/types"
import { isPaletteHotkey, paletteOpen, setPaletteOpen } from "../palette/state"
import { transfers } from "../transfers/service"
import { BottomTabs, TAB_BAR_HEIGHT } from "./BottomTabs"
import {
  activeNavId,
  preloadAllSections,
  readCollapsed,
  writeCollapsed,
} from "./nav-items"
import { FULL_WIDTH, RAIL_WIDTH, SideNav } from "./SideNav"
import { TOP_BAR_HEIGHT, TopBar } from "./TopBar"
import { bindTransfersToUser } from "./transfers-lifecycle"
import { bottomBarOverride, setPhoneShell, setShellActive } from "./topbar-slot"
import { createViewport } from "./viewport"

const TaskCenter = lazy(() => import("../transfers/TaskCenter"))
const ErrorCenter = lazy(() => import("../notifications/ErrorCenter"))
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

  // me() is empty until SessionGate has loaded it. It revalidates /me on every
  // section change, so everything that must only follow the sign-in state reads
  // these memos, not me() itself: they change when the user does.
  const shown = createMemo(
    () => me().id !== undefined && !UserMethods.is_guest(me()),
  )
  const userId = createMemo(() => (shown() ? me().id : undefined))
  const rail = () =>
    viewport() === "tablet" || (viewport() === "desktop" && folded())

  bindTransfersToUser(userId, transfers)

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

  // Once signed in, fetch the section chunks while the browser is idle so the
  // first click on each of them has nothing left to download.
  createEffect(() => {
    if (shown()) onCleanup(preloadAllSections())
  })

  createEffect(() => setShellActive(shown()))
  onCleanup(() => setShellActive(false))

  const wide = () => shown() && viewport() !== "phone"
  const phone = () => shown() && viewport() === "phone"
  // The settings pages are a page of their own (menu on the left, a titled
  // card): on tablet and desktop the bar above them would only repeat that.
  // Phones keep it for the way back.
  const topBar = () =>
    shown() && !(activeNavId(pathname()) === "settings" && !phone())

  createEffect(() => setPhoneShell(phone()))
  onCleanup(() => setPhoneShell(false))

  createEffect(() => {
    document.documentElement.classList.toggle("shell-phone", phone())
    onCleanup(() => document.documentElement.classList.remove("shell-phone"))
  })
  // The floating panels' variables (tokens.css) apply while the wide shell is on.
  createEffect(() => {
    document.documentElement.classList.toggle("shell-wide", wide())
    onCleanup(() => document.documentElement.classList.remove("shell-wide"))
  })

  // The content wrapper is always rendered, so the page underneath is not
  // remounted when the nav appears once the user has loaded. The chrome around
  // it sits in stable `display: contents` slots for the same reason: if
  // siblings on both sides of the frame come and go at once (a rotation), Solid
  // moves the frame with insertBefore, which tears down a fullscreen element
  // (the movi player) or an iframe inside it. The frame must never be moved.
  return (
    <>
      <div style={{ display: "contents" }}>
        <Show when={wide()}>
          <SideNav
            pathname={pathname()}
            rail={rail()}
            onToggle={viewport() === "desktop" ? fold : undefined}
          />
        </Show>
      </div>
      <div
        data-shell-frame
        class="w-full min-w-0 transition-[padding] duration-150"
        style={{
          // The side panel is fixed; the content panel makes room for it.
          "padding-left": wide() ? "var(--shell-content-left)" : "0",
          "padding-right": wide() ? "var(--shell-content-right)" : "0",
          "padding-top": wide() ? "var(--shell-gap)" : "0",
          "padding-bottom": phone()
            ? `calc(${TAB_BAR_HEIGHT} + env(safe-area-inset-bottom))`
            : wide()
              ? "var(--shell-gap)"
              : "0",
          // Fixed elements inside the page line up with the content panel.
          "--shell-content-left": wide()
            ? `calc(var(--shell-left) + ${rail() ? RAIL_WIDTH : FULL_WIDTH} + var(--shell-gap))`
            : "0px",
        }}
      >
        <div
          data-shell-content
          class="min-w-0"
          classList={{
            "overflow-clip rounded-[var(--shell-radius)] border bg-background":
              wide(),
          }}
          style={{
            "min-height": wide() ? "calc(100dvh - 2 * var(--shell-gap))" : "0",
            // Pages that size themselves to the viewport subtract this; it is
            // also where their sticky bars stop below the top of the window.
            "--shell-top": !shown()
              ? "0px"
              : topBar()
                ? `calc(var(--shell-gap, 0px) + ${TOP_BAR_HEIGHT})`
                : "var(--shell-gap, 0px)",
            // What pinned bars must stay above (the phone tab bar).
            "--shell-bottom": phone()
              ? `calc(${TAB_BAR_HEIGHT} + env(safe-area-inset-bottom))`
              : "0px",
          }}
        >
          <Show when={topBar()}>
            <TopBar pathname={pathname()} phone={phone()} />
          </Show>
          {/* One enter animation per section, none inside it (the file browser
            has its own transitions). The old section stays until the new one
            is ready; there is no exit. Whatever suspends below stops at the
            Suspense, which must sit outside the keyed frame so that it is the
            same boundary across sections: the nav and the top bar stay. */}
          <Suspense fallback={<FullLoading />}>
            <Show when={activeNavId(pathname()) ?? "none"} keyed>
              {(_section) => (
                <Motion.div
                  {...asMotion(motionProps(sectionEnter))}
                  // A resting transform would make this box the containing
                  // block of the page's position: fixed elements.
                  onMotionComplete={(e) =>
                    (e.target as HTMLElement).style.removeProperty("transform")
                  }
                >
                  {props.children}
                </Motion.div>
              )}
            </Show>
          </Suspense>
        </div>
      </div>
      <div style={{ display: "contents" }}>
        <Show when={phone()}>
          <Show
            when={bottomBarOverride()?.when()}
            fallback={<BottomTabs pathname={pathname()} />}
          >
            {bottomBarOverride()!.render()}
          </Show>
        </Show>
      </div>
      <div style={{ display: "contents" }}>
        <Show when={shown() && paletteUsed()}>
          <CommandPalette />
        </Show>
      </div>
      <div style={{ display: "contents" }}>
        <Show when={wide()}>
          <TaskCenter />
        </Show>
      </div>
      <div style={{ display: "contents" }}>
        <Show when={shown()}>
          <ErrorCenter />
        </Show>
      </div>
    </>
  )
}

export default AppShell
