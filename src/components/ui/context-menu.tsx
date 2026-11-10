// The shadcn-solid context menu, in the shape of dropdown-menu.tsx. Kobalte's
// menu parts are shared between the dropdown and the context menu, so the
// items, groups, separators and submenus are the dropdown-menu ones.
import { cn } from "~/utils/cn"
import * as ContextMenuPrimitive from "@kobalte/core/context-menu"
import type { PolymorphicProps } from "@kobalte/core/polymorphic"
import type { ValidComponent } from "solid-js"
import { splitProps } from "solid-js"

export {
  DropdownMenuGroup as ContextMenuGroup,
  DropdownMenuItem as ContextMenuItem,
  DropdownMenuSeparator as ContextMenuSeparator,
  DropdownMenuSub as ContextMenuSub,
  DropdownMenuSubContent as ContextMenuSubContent,
  DropdownMenuSubTrigger as ContextMenuSubTrigger,
} from "./dropdown-menu"

export const ContextMenu = ContextMenuPrimitive.Root
export const ContextMenuTrigger = ContextMenuPrimitive.Trigger

type ContextMenuContentProps = ContextMenuPrimitive.ContextMenuContentProps & {
  class?: string
}

export const ContextMenuContent = <T extends ValidComponent = "div">(
  props: PolymorphicProps<T, ContextMenuContentProps>,
) => {
  const [local, rest] = splitProps(props as ContextMenuContentProps, ["class"])

  return (
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.Content
        class={cn(
          "z-[1500] min-w-[200px] overflow-hidden rounded-[var(--radius-menu)] border bg-popover p-1 text-popover-foreground shadow-md outline-none! data-[expanded]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[expanded]:fade-in-0 data-[closed]:zoom-out-95 data-[expanded]:zoom-in-95",
          local.class,
        )}
        {...rest}
      />
    </ContextMenuPrimitive.Portal>
  )
}
