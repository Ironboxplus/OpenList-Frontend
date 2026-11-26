import { createSignal, For, Show } from "solid-js"
import { useT } from "~/hooks"
import { me } from "~/store"
import { NavResizer } from "./NavResizer"
import { NavTree } from "./NavTree"
import { SideNavEntry } from "./SideNavEntry"
import { StorageCard } from "./StorageCard"
import { activeNavId, navItemsFor } from "./nav-items"

export const RAIL_WIDTH = "72px"
const NAV_ID = "shell-side-nav"

export interface SideNavProps {
  pathname: string
  /** Icon-only rail (tablet, or desktop folded by the user). */
  rail: boolean
  /** Width of the full nav, px (the user drags it between 220 and maxWidth). */
  width: number
  maxWidth: number
  onResize: (width: number, done: boolean) => void
  onResizing?: (dragging: boolean) => void
}

/**
 * The side nav, lying directly on the canvas under the top bar (which holds
 * the logo, the fold button, settings and the account). While Files is the
 * section its entry unfolds into the folder tree. Unfolded, a handle on its
 * right edge sets its width.
 */
export const SideNav = (props: SideNavProps) => {
  const t = useT()
  const active = () => activeNavId(props.pathname)
  const [dragging, setDragging] = createSignal(false)
  return (
    <>
      <nav
        id={NAV_ID}
        aria-label="main"
        class="fixed z-[1200] flex flex-col gap-1 overflow-y-auto overflow-x-hidden pr-1"
        // following the pointer, not 150ms behind it
        classList={{ "transition-[width] duration-150": !dragging() }}
        style={{
          width: props.rail ? RAIL_WIDTH : `${props.width}px`,
          top: "var(--shell-header)",
          left: "var(--shell-left)",
          height: "calc(100dvh - var(--shell-header) - var(--shell-gap))",
        }}
      >
        <For each={navItemsFor(me(), "main")}>
          {(i) => (
            <Show
              when={i.id === "files" && active() === "files" && !props.rail}
              fallback={
                <SideNavEntry
                  item={i}
                  active={active() === i.id}
                  rail={props.rail}
                  label={t(i.labelKey)}
                />
              }
            >
              <NavTree label={t(i.labelKey)} />
            </Show>
          )}
        </For>
        <Show when={!props.rail}>
          <StorageCard class="mt-auto" />
        </Show>
      </nav>
      <Show when={!props.rail}>
        <NavResizer
          width={props.width}
          max={props.maxWidth}
          label={t("shell.nav.resize")}
          controls={NAV_ID}
          onResize={props.onResize}
          onDragging={(on) => {
            setDragging(on)
            props.onResizing?.(on)
          }}
        />
      </Show>
    </>
  )
}
