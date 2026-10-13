import { focusRing } from "~/components/ui/focus"
import {
  TbLayoutSidebarLeftCollapse,
  TbLayoutSidebarLeftExpand,
  TbLogout,
  TbSun,
  TbUserCircle,
} from "solid-icons/tb"
import { createEffect, createSignal, For, on, onMount, Show } from "solid-js"
import { Motion } from "solid-motionone"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip"
import { useT } from "~/hooks"
import { me } from "~/store"
import { cn } from "~/utils/cn"
import {
  asMotion,
  motionTransition,
  navIndicatorMove,
} from "~/utils/motion-presets"
import { useAccountActions } from "./account"
import { SideNavEntry, navRowClass } from "./SideNavEntry"
import {
  activeNavId,
  badgeTarget,
  navItemsFor,
  type NavItem,
} from "./nav-items"

export const RAIL_WIDTH = "72px"
export const FULL_WIDTH = "220px"

export interface SideNavProps {
  pathname: string
  /** Icon-only rail (tablet, or desktop folded by the user). */
  rail: boolean
  /** Desktop only: lets the user fold the full sidebar into a rail. */
  onToggle?: () => void
}

export const SideNav = (props: SideNavProps) => {
  const t = useT()
  const account = useAccountActions()
  const active = () => activeNavId(props.pathname)

  // One highlight block for the active row; it slides between rows instead of
  // each row toggling its own background.
  let nav!: HTMLElement
  const [indicatorY, setIndicatorY] = createSignal<number>()
  const place = () => {
    const row = nav.querySelector<HTMLElement>(`[data-nav-id="${active()}"]`)
    if (!row) return setIndicatorY(undefined)
    setIndicatorY(
      row.getBoundingClientRect().top -
        nav.getBoundingClientRect().top -
        nav.clientTop,
    )
  }
  onMount(place)
  // The rows move when the list changes (a section appears or goes away).
  createEffect(
    on([active, () => navItemsFor(me()).length], place, { defer: true }),
  )

  return (
    <nav
      ref={nav}
      aria-label="main"
      class="fixed z-[1200] flex flex-col gap-1 border bg-card p-3 text-card-foreground shadow-sm transition-[width] duration-150"
      style={{
        width: props.rail ? RAIL_WIDTH : FULL_WIDTH,
        top: "var(--shell-gap)",
        left: "var(--shell-left)",
        height: "calc(100dvh - 2 * var(--shell-gap))",
        "border-radius": "var(--shell-radius)",
      }}
    >
      <Show when={indicatorY() !== undefined}>
        <Motion.div
          aria-hidden="true"
          data-nav-indicator
          class="pointer-events-none absolute left-3 right-3 top-0 h-10 rounded-lg bg-accent"
          initial={false}
          animate={{ y: indicatorY() }}
          transition={asMotion(motionTransition(navIndicatorMove))}
        />
      </Show>
      <div class="flex flex-1 flex-col gap-1">
        <For each={navItemsFor(me(), "main")}>
          {(i) => (
            <SideNavEntry
              item={i}
              active={active() === i.id}
              rail={props.rail}
              label={t(i.labelKey)}
            />
          )}
        </For>
      </div>
      <div class="flex flex-col gap-1 border-t pt-2">
        <For each={navItemsFor(me(), "secondary")}>
          {(i) => (
            <SideNavEntry
              item={i}
              active={active() === i.id}
              rail={props.rail}
              label={t(i.labelKey)}
            />
          )}
        </For>
        <DropdownMenu placement="right-end">
          <DropdownMenuTrigger
            aria-label={t("shell.nav.account")}
            class={cn(navRowClass, props.rail && "justify-center px-0")}
          >
            <TbUserCircle class="size-5 shrink-0" />
            <Show when={!props.rail}>
              <span class="flex-1 truncate text-left">{me().username}</span>
            </Show>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onSelect={account.profile} class="gap-2">
              <TbUserCircle class="size-4" />
              {t("shell.nav.profile")}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={account.toggleTheme} class="gap-2">
              <TbSun class="size-4" />
              {t("shell.nav.toggle_theme")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={account.logout}
              class="gap-2 text-destructive"
            >
              <TbLogout class="size-4" />
              {t("manage.logout")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Show when={props.onToggle}>
          <button
            type="button"
            onClick={props.onToggle}
            aria-label={t(
              props.rail ? "shell.nav.expand" : "shell.nav.collapse",
            )}
            class={cn(navRowClass, props.rail && "justify-center px-0")}
          >
            <Show
              when={props.rail}
              fallback={<TbLayoutSidebarLeftCollapse class="size-5 shrink-0" />}
            >
              <TbLayoutSidebarLeftExpand class="size-5 shrink-0" />
            </Show>
            <Show when={!props.rail}>
              <span class="truncate">{t("shell.nav.collapse")}</span>
            </Show>
          </button>
        </Show>
      </div>
    </nav>
  )
}
