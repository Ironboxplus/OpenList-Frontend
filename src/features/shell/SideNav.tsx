import { focusRing } from "~/components/ui/focus"
import {
  TbLayoutSidebarLeftCollapse,
  TbLayoutSidebarLeftExpand,
  TbLogout,
  TbSun,
  TbUserCircle,
} from "solid-icons/tb"
import { For, Show } from "solid-js"
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

  return (
    <nav
      aria-label="main"
      class="fixed inset-y-0 left-0 z-[1200] flex flex-col gap-1 border-r bg-card p-3 text-card-foreground transition-[width] duration-150"
      style={{ width: props.rail ? RAIL_WIDTH : FULL_WIDTH }}
    >
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
