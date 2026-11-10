import { For, Show } from "solid-js"
import { useT } from "~/hooks"
import { me } from "~/store"
import { NavTree } from "./NavTree"
import { SideNavEntry } from "./SideNavEntry"
import { activeNavId, navItemsFor } from "./nav-items"

export const RAIL_WIDTH = "72px"
export const FULL_WIDTH = "220px"

export interface SideNavProps {
  pathname: string
  /** Icon-only rail (tablet, or desktop folded by the user). */
  rail: boolean
}

/**
 * The side nav, lying directly on the canvas under the top bar (which holds
 * the logo, the fold button, settings and the account). While Files is the
 * section its entry unfolds into the folder tree.
 */
export const SideNav = (props: SideNavProps) => {
  const t = useT()
  const active = () => activeNavId(props.pathname)
  return (
    <nav
      aria-label="main"
      class="fixed z-[1200] flex flex-col gap-1 overflow-y-auto overflow-x-hidden pr-1 transition-[width] duration-150"
      style={{
        width: props.rail ? RAIL_WIDTH : FULL_WIDTH,
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
    </nav>
  )
}
