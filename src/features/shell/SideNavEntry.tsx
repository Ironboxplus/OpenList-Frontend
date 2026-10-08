import { Show } from "solid-js"
import { focusRing } from "~/components/ui/focus"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip"
import { cn } from "~/utils/cn"
import { NavIconView } from "./icons"
import { NavBadge } from "./NavBadge"
import { NavLink } from "./NavLink"
import { badgeTarget, type NavItem } from "./nav-items"

export const navRowClass =
  `${focusRing} ` +
  "flex h-10 items-center gap-3 rounded-lg bg-transparent px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"

/** One primary-nav row; icon-only (with a tooltip) when `rail`. */
export const SideNavEntry = (props: {
  item: NavItem
  active: boolean
  rail: boolean
  label: string
}) => {
  // A function, not a node: the two branches below each need their own copy.
  // Sharing one node made <For>'s reconcileArrays insert the new branch (which
  // now contained the node) before the node itself: HierarchyRequestError.
  const link = () => (
    <NavLink
      path={props.item.path}
      aria-current={props.active ? "page" : undefined}
      aria-label={props.rail ? props.label : undefined}
      class={cn(
        navRowClass,
        "relative",
        props.rail && "justify-center px-0",
        props.active && "bg-accent text-foreground",
      )}
    >
      <NavIconView icon={props.item.icon} />
      <Show when={!props.rail}>
        <span class="flex-1 truncate">{props.label}</span>
      </Show>
      <Show when={badgeTarget(props.item.id)}>
        <NavBadge class={props.rail ? "absolute right-2 top-1.5" : ""} />
      </Show>
    </NavLink>
  )
  return (
    <Show when={props.rail} fallback={link()}>
      <Tooltip placement="right">
        <TooltipTrigger as="div" class="block">
          {link()}
        </TooltipTrigger>
        <TooltipContent>{props.label}</TooltipContent>
      </Tooltip>
    </Show>
  )
}
