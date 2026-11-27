// The shadcn-solid context menu, in the shape of dropdown-menu.tsx. Kobalte's
// menu parts are shared between the dropdown and the context menu, so the
// items, groups, separators and submenus are the dropdown-menu ones.
import { cn } from "~/utils/cn"
import * as ContextMenuPrimitive from "@kobalte/core/context-menu"
import type { PolymorphicProps } from "@kobalte/core/polymorphic"
import type { ValidComponent } from "solid-js"
import { splitProps } from "solid-js"
import { useMenuContext } from "@kobalte/core/menu"
import { menuPanel } from "./dropdown-menu"
import { createMenuCloseQueue, MenuCloseContext } from "./menu-after-close"
import { OverlayPresence, withRef } from "./overlay-presence"

export {
  DropdownMenuGroup as ContextMenuGroup,
  DropdownMenuItem as ContextMenuItem,
  DropdownMenuSeparator as ContextMenuSeparator,
  DropdownMenuSub as ContextMenuSub,
  DropdownMenuSubContent as ContextMenuSubContent,
  DropdownMenuSubTrigger as ContextMenuSubTrigger,
} from "./dropdown-menu"

/** Mounted through its exit, like DropdownMenu (overlay-presence.tsx). */
export const ContextMenu = ((
  props: ContextMenuPrimitive.ContextMenuRootProps,
) => (
  <ContextMenuPrimitive.Root forceMount {...props} />
)) as typeof ContextMenuPrimitive.Root
export const ContextMenuTrigger = ContextMenuPrimitive.Trigger

type ContextMenuContentProps = ContextMenuPrimitive.ContextMenuContentProps & {
  class?: string
  ref?: unknown
}

export const ContextMenuContent = <T extends ValidComponent = "div">(
  props: PolymorphicProps<T, ContextMenuContentProps>,
) => {
  const [local, rest] = splitProps(props as ContextMenuContentProps, [
    "class",
    "onOpenAutoFocus",
    "onCloseAutoFocus",
    "ref",
  ])
  const close = createMenuCloseQueue(local)
  const menu = useMenuContext()

  return (
    <MenuCloseContext.Provider value={close.queue}>
      <OverlayPresence open={menu.isOpen} kind="menu">
        {(ref) => (
          <ContextMenuPrimitive.Portal>
            <ContextMenuPrimitive.Content
              data-motion="menu"
              ref={withRef(ref, local.ref)}
              onOpenAutoFocus={close.onOpenAutoFocus}
              onCloseAutoFocus={close.onCloseAutoFocus}
              class={cn(menuPanel, "min-w-[200px] outline-none!", local.class)}
              {...rest}
            />
          </ContextMenuPrimitive.Portal>
        )}
      </OverlayPresence>
    </MenuCloseContext.Provider>
  )
}
