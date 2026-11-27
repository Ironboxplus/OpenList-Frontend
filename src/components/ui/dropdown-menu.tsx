// Copied from shadcn-solid (hngngn/shadcn-solid) tag shadcn-solid@0.7.0
// (commit 08b8ce27d80b289fe983051a14541ff53e08d9cb), registry/frameworks/tailwindcss/.
// The CLI is not used offline-first; imports were adapted to this repo's alias.
import { cn } from "~/utils/cn"
import * as DropdownMenuPrimitive from "@kobalte/core/dropdown-menu"
import type { PolymorphicProps } from "@kobalte/core/polymorphic"
import type { ComponentProps, ParentProps, ValidComponent } from "solid-js"
import { mergeProps, splitProps } from "solid-js"
import { useMenuContext } from "@kobalte/core/menu"
import { OverlayPresence, withRef } from "./overlay-presence"
import {
  createMenuCloseQueue,
  MenuCloseContext,
  useMenuCloseQueue,
} from "./menu-after-close"

export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger
export const DropdownMenuGroup = DropdownMenuPrimitive.Group
export const DropdownMenuSub = DropdownMenuPrimitive.Sub
export const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup

export const DropdownMenu = (
  props: DropdownMenuPrimitive.DropdownMenuRootProps,
) => {
  // forceMount: our presence unmounts the content after its exit (overlay-presence.tsx)
  const merge = mergeProps({ gutter: 4, forceMount: true }, props)

  return <DropdownMenuPrimitive.Root {...merge} />
}

type DropdownMenuContentProps =
  DropdownMenuPrimitive.DropdownMenuContentProps & {
    class?: string
    ref?: unknown
  }

/**
 * A menu's panel: grows from its anchor, 120ms in and 90ms out. Drawn over
 * the toasts as over dialogs (the layers: app/theme.ts).
 */
export const menuPanel =
  "z-[1540] min-w-[8rem] origin-[var(--kb-menu-content-transform-origin)] overflow-hidden rounded-[var(--radius-menu)] border bg-popover p-1 text-popover-foreground shadow-md"

export const DropdownMenuContent = <T extends ValidComponent = "div">(
  props: PolymorphicProps<T, DropdownMenuContentProps>,
) => {
  const [local, rest] = splitProps(props as DropdownMenuContentProps, [
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
          <DropdownMenuPrimitive.Portal>
            <DropdownMenuPrimitive.Content
              data-motion="menu"
              ref={withRef(ref, local.ref)}
              onOpenAutoFocus={close.onOpenAutoFocus}
              onCloseAutoFocus={close.onCloseAutoFocus}
              class={cn(
                menuPanel,
                "transition-shadow outline-none! focus-visible:ring-[1.5px] focus-visible:ring-ring",
                local.class,
              )}
              {...rest}
            />
          </DropdownMenuPrimitive.Portal>
        )}
      </OverlayPresence>
    </MenuCloseContext.Provider>
  )
}

type DropdownMenuItemProps = DropdownMenuPrimitive.DropdownMenuItemProps & {
  class?: string
  inset?: boolean
}

export const DropdownMenuItem = <T extends ValidComponent = "div">(
  props: PolymorphicProps<T, DropdownMenuItemProps>,
) => {
  const [local, rest] = splitProps(props as DropdownMenuItemProps, [
    "class",
    "inset",
    "onSelect",
  ])
  const close = useMenuCloseQueue()

  return (
    <DropdownMenuPrimitive.Item
      onSelect={() => {
        // an item that closes the menu acts once it has closed (menu-after-close.ts);
        // one that keeps it open (closeOnSelect={false}) acts at once
        if (close && (props as DropdownMenuItemProps).closeOnSelect !== false) {
          close.defer(() => local.onSelect?.())
        } else {
          local.onSelect?.()
        }
      }}
      class={cn(
        "relative flex cursor-default select-none items-center rounded-[6px] px-2 py-1.5 text-sm outline-none! transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        local.inset && "pl-8",
        local.class,
      )}
      {...rest}
    />
  )
}

type DropdownMenuGroupLabelProps =
  DropdownMenuPrimitive.DropdownMenuGroupLabelProps & {
    class?: string
  }

export const DropdownMenuGroupLabel = <T extends ValidComponent = "span">(
  props: PolymorphicProps<T, DropdownMenuGroupLabelProps>,
) => {
  const [local, rest] = splitProps(props as DropdownMenuGroupLabelProps, [
    "class",
  ])

  return (
    <DropdownMenuPrimitive.GroupLabel
      as="div"
      class={cn("px-2 py-1.5 text-sm font-semibold", local.class)}
      {...rest}
    />
  )
}

type DropdownMenuItemLabelProps =
  DropdownMenuPrimitive.DropdownMenuItemLabelProps & {
    class?: string
  }

export const DropdownMenuItemLabel = <T extends ValidComponent = "div">(
  props: PolymorphicProps<T, DropdownMenuItemLabelProps>,
) => {
  const [local, rest] = splitProps(props as DropdownMenuItemLabelProps, [
    "class",
  ])

  return (
    <DropdownMenuPrimitive.ItemLabel
      class={cn("px-2 py-1.5 text-sm font-semibold", local.class)}
      {...rest}
    />
  )
}

type DropdownMenuSeparatorProps =
  DropdownMenuPrimitive.DropdownMenuItemLabelProps & {
    class?: string
  }

export const DropdownMenuSeparator = <T extends ValidComponent = "hr">(
  props: PolymorphicProps<T, DropdownMenuSeparatorProps>,
) => {
  const [local, rest] = splitProps(props as DropdownMenuSeparatorProps, [
    "class",
  ])

  return (
    <DropdownMenuPrimitive.Separator
      class={cn("-mx-1 my-1 h-px bg-muted", local.class)}
      {...rest}
    />
  )
}

export const DropdownMenuShortcut = (props: ComponentProps<"span">) => {
  const [local, rest] = splitProps(props, ["class"])

  return (
    <span
      class={cn("ml-auto text-xs tracking-widest opacity-60", local.class)}
      {...rest}
    />
  )
}

type DropdownMenuSubTriggerProps = ParentProps<
  DropdownMenuPrimitive.DropdownMenuSubTriggerProps & {
    class?: string
  }
>

export const DropdownMenuSubTrigger = <T extends ValidComponent = "div">(
  props: PolymorphicProps<T, DropdownMenuSubTriggerProps>,
) => {
  const [local, rest] = splitProps(props as DropdownMenuSubTriggerProps, [
    "class",
    "children",
    "onPointerLeave",
  ])
  const menu = useMenuContext()
  // Leaving the trigger, Kobalte keeps the submenu open if the pointer heads
  // for it, the way being that of the last move inside the parent menu,
  // "right" until there is one (@kobalte/core 0.13.14 chunk/FWLJS4DZ.jsx:200,
  // :265, :905-915). With no room on the right (a phone) the submenu opens on
  // the left, and a pointer that crosses into it in one move read as heading
  // away: the parent took the focus back and the submenu closed (:273-278,
  // :1331). The side the pointer left the trigger by is its way.
  const onPointerLeave = (e: PointerEvent) => {
    if (e.pointerType === "mouse") {
      const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
      const parent = menu.parentMenuContext()
      if (e.clientX <= r.left) parent?.setPointerDir("left")
      else if (e.clientX >= r.right) parent?.setPointerDir("right")
    }
    const theirs = local.onPointerLeave as unknown
    if (typeof theirs === "function") (theirs as (e: PointerEvent) => void)(e)
  }

  return (
    <DropdownMenuPrimitive.SubTrigger
      onPointerLeave={onPointerLeave}
      class={cn(
        "flex cursor-default select-none items-center rounded-[6px] px-2 py-1.5 text-sm outline-none! focus:bg-accent data-[expanded]:bg-accent",
        local.class,
      )}
      {...rest}
    >
      {local.children}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="1em"
        height="1em"
        viewBox="0 0 24 24"
        class="ml-auto h-4 w-4"
      >
        <path
          fill="none"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="m9 6l6 6l-6 6"
        />
      </svg>
    </DropdownMenuPrimitive.SubTrigger>
  )
}

type DropdownMenuSubContentProps =
  DropdownMenuPrimitive.DropdownMenuSubTriggerProps & {
    class?: string
    ref?: unknown
  }

export const DropdownMenuSubContent = <T extends ValidComponent = "div">(
  props: PolymorphicProps<T, DropdownMenuSubContentProps>,
) => {
  const [local, rest] = splitProps(props as DropdownMenuSubContentProps, [
    "class",
    "ref",
  ])
  const menu = useMenuContext()

  return (
    <OverlayPresence open={menu.isOpen} kind="menu">
      {(ref) => (
        <DropdownMenuPrimitive.Portal>
          <DropdownMenuPrimitive.SubContent
            data-motion="menu"
            ref={withRef(ref, local.ref)}
            class={cn(menuPanel, local.class)}
            {...rest}
          />
        </DropdownMenuPrimitive.Portal>
      )}
    </OverlayPresence>
  )
}

type DropdownMenuCheckboxItemProps = ParentProps<
  DropdownMenuPrimitive.DropdownMenuCheckboxItemProps & {
    class?: string
  }
>

export const DropdownMenuCheckboxItem = <T extends ValidComponent = "div">(
  props: PolymorphicProps<T, DropdownMenuCheckboxItemProps>,
) => {
  const [local, rest] = splitProps(props as DropdownMenuCheckboxItemProps, [
    "class",
    "children",
  ])

  return (
    <DropdownMenuPrimitive.CheckboxItem
      class={cn(
        "relative flex cursor-default select-none items-center rounded-[6px] py-1.5 pl-8 pr-2 text-sm outline-none! transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        local.class,
      )}
      {...rest}
    >
      <DropdownMenuPrimitive.ItemIndicator class="absolute left-2 inline-flex h-4 w-4 items-center justify-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          class="h-4 w-4"
        >
          <path
            fill="none"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="m5 12l5 5L20 7"
          />
        </svg>
      </DropdownMenuPrimitive.ItemIndicator>
      {props.children}
    </DropdownMenuPrimitive.CheckboxItem>
  )
}

type DropdownMenuRadioItemProps = ParentProps<
  DropdownMenuPrimitive.DropdownMenuRadioItemProps & {
    class?: string
  }
>

export const DropdownMenuRadioItem = <T extends ValidComponent = "div">(
  props: PolymorphicProps<T, DropdownMenuRadioItemProps>,
) => {
  const [local, rest] = splitProps(props as DropdownMenuRadioItemProps, [
    "class",
    "children",
  ])

  return (
    <DropdownMenuPrimitive.RadioItem
      class={cn(
        "relative flex cursor-default select-none items-center rounded-[6px] py-1.5 pl-8 pr-2 text-sm outline-none! transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        local.class,
      )}
      {...rest}
    >
      <DropdownMenuPrimitive.ItemIndicator class="absolute left-2 inline-flex h-4 w-4 items-center justify-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          class="h-2 w-2"
        >
          <g
            fill="none"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
          >
            <path d="M0 0h24v24H0z" />
            <path
              fill="currentColor"
              d="M7 3.34a10 10 0 1 1-4.995 8.984L2 12l.005-.324A10 10 0 0 1 7 3.34"
            />
          </g>
        </svg>
      </DropdownMenuPrimitive.ItemIndicator>
      {props.children}
    </DropdownMenuPrimitive.RadioItem>
  )
}
