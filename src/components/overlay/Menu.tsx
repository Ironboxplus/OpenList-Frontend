import type { DropdownMenuRootProps } from "@kobalte/core/dropdown-menu"
import { type JSX, type ParentProps, Show, splitProps } from "solid-js"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { cn } from "~/utils/cn"

export interface MenuProps {
  /** hope's default: bottom-start, 5px off the trigger. */
  placement?: DropdownMenuRootProps["placement"]
  offset?: number
  children?: JSX.Element
}

/**
 * hope-ui's Menu API on the kit's DropdownMenu (Kobalte), whose items act
 * after the menu has closed (menu-after-close.ts).
 */
export const Menu = (props: MenuProps) => (
  <DropdownMenu
    placement={props.placement ?? "bottom-start"}
    gutter={props.offset ?? 5}
  >
    {props.children}
  </DropdownMenu>
)

/**
 * The trigger; `as` (a hope component) draws it and takes its style props,
 * Kobalte adds the ref, handlers and aria.
 */
export const MenuTrigger = DropdownMenuTrigger

export const MenuContent = (props: ParentProps<{ class?: string }>) => (
  <DropdownMenuContent class={props.class}>
    {props.children}
  </DropdownMenuContent>
)

export interface MenuItemProps {
  onSelect?: () => void
  /** Mapped to onSelect, so it too runs after the menu has closed. */
  onClick?: () => void
  /** "danger" draws the item as destructive; the other schemes as normal. */
  colorScheme?: string
  /** A hope colour token; a danger one draws the item as destructive. */
  color?: string
  icon?: JSX.Element
  disabled?: boolean
  class?: string
  children?: JSX.Element
}

export const MenuItem = (props: MenuItemProps) => {
  const [local] = splitProps(props, [
    "onSelect",
    "onClick",
    "colorScheme",
    "color",
    "icon",
    "disabled",
    "class",
    "children",
  ])
  const danger = () =>
    local.colorScheme === "danger" || !!local.color?.includes("danger")
  return (
    <DropdownMenuItem
      disabled={local.disabled}
      onSelect={() => {
        local.onSelect?.()
        local.onClick?.()
      }}
      class={cn(
        "gap-2",
        danger() && "text-destructive focus:text-destructive",
        local.class,
      )}
    >
      <Show when={local.icon}>
        <span class="inline-flex size-4 shrink-0 items-center justify-center">
          {local.icon}
        </span>
      </Show>
      {local.children}
    </DropdownMenuItem>
  )
}
