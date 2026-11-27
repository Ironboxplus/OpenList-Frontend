// Built on @kobalte/core/combobox in the shape of the shadcn-solid combobox
// (hngngn/shadcn-solid@0.7.0). The shadcn `command` palette needs cmdk-solid,
// which this repo does not depend on; a combobox is the searchable select.
import { cn } from "~/utils/cn"
import * as ComboboxPrimitive from "@kobalte/core/combobox"
import type { PolymorphicProps } from "@kobalte/core/polymorphic"
import type { ParentProps, ValidComponent } from "solid-js"
import { OverlayPresence, withRef } from "./overlay-presence"
import { splitProps } from "solid-js"

/** Mounted through its exit (overlay-presence.tsx): Kobalte keeps the list mounted. */
export const Combobox = ((props: any) => (
  <ComboboxPrimitive.Root forceMount {...props} />
)) as typeof ComboboxPrimitive.Root
export const ComboboxItemLabel = ComboboxPrimitive.ItemLabel
export const ComboboxHiddenSelect = ComboboxPrimitive.HiddenSelect

type ControlProps = ParentProps<
  ComboboxPrimitive.ComboboxControlProps<any> & { class?: string }
>

export const ComboboxControl = <T extends ValidComponent = "div">(
  props: PolymorphicProps<T, ControlProps>,
) => {
  const [local, rest] = splitProps(props as ControlProps, ["class", "children"])
  return (
    <ComboboxPrimitive.Control
      class={cn(
        "flex h-9 w-full items-center rounded-md border border-input bg-transparent text-sm shadow-sm transition-shadow focus-within:ring-[1.5px] focus-within:ring-ring data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50",
        local.class,
      )}
      {...rest}
    >
      {local.children}
    </ComboboxPrimitive.Control>
  )
}

type InputProps = ComboboxPrimitive.ComboboxInputProps & { class?: string }

export const ComboboxInput = <T extends ValidComponent = "input">(
  props: PolymorphicProps<T, InputProps>,
) => {
  const [local, rest] = splitProps(props as InputProps, ["class"])
  return (
    <ComboboxPrimitive.Input
      class={cn(
        "h-full min-w-0 flex-1 bg-transparent px-3 text-sm outline-none! placeholder:text-muted-foreground",
        local.class,
      )}
      {...rest}
    />
  )
}

type TriggerProps = ComboboxPrimitive.ComboboxTriggerProps & { class?: string }

export const ComboboxTrigger = <T extends ValidComponent = "button">(
  props: PolymorphicProps<T, TriggerProps>,
) => {
  const [local, rest] = splitProps(props as TriggerProps, ["class"])
  return (
    <ComboboxPrimitive.Trigger
      class={cn(
        "flex h-full w-9 shrink-0 items-center justify-center bg-transparent text-muted-foreground outline-none!",
        local.class,
      )}
      {...rest}
    >
      <ComboboxPrimitive.Icon
        as="svg"
        xmlns="http://www.w3.org/2000/svg"
        width="1em"
        height="1em"
        viewBox="0 0 24 24"
        class="size-4 opacity-50"
      >
        <path
          fill="none"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="m8 9l4-4l4 4m0 6l-4 4l-4-4"
        />
      </ComboboxPrimitive.Icon>
    </ComboboxPrimitive.Trigger>
  )
}

type ContentProps = ComboboxPrimitive.ComboboxContentProps & {
  class?: string
  ref?: unknown
}

export const ComboboxContent = <T extends ValidComponent = "div">(
  props: PolymorphicProps<T, ContentProps>,
) => {
  const [local, rest] = splitProps(props as ContentProps, ["class", "ref"])
  const list = ComboboxPrimitive.useComboboxContext()
  return (
    <OverlayPresence open={list.isOpen} kind="select">
      {(ref) => (
        <ComboboxPrimitive.Portal>
          <ComboboxPrimitive.Content
            data-motion="select"
            ref={withRef(ref, local.ref)}
            class={cn(
              "relative z-[1540] min-w-[8rem] origin-[var(--kb-combobox-content-transform-origin)] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md",
              local.class,
            )}
            {...rest}
          >
            <ComboboxPrimitive.Listbox class="max-h-72 overflow-y-auto p-1 outline-none!" />
          </ComboboxPrimitive.Content>
        </ComboboxPrimitive.Portal>
      )}
    </OverlayPresence>
  )
}

type ItemProps = ParentProps<
  ComboboxPrimitive.ComboboxItemProps & { class?: string }
>

export const ComboboxItem = <T extends ValidComponent = "li">(
  props: PolymorphicProps<T, ItemProps>,
) => {
  const [local, rest] = splitProps(props as ItemProps, ["class", "children"])
  return (
    <ComboboxPrimitive.Item
      class={cn(
        "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none! data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        local.class,
      )}
      {...rest}
    >
      <ComboboxPrimitive.ItemIndicator class="absolute right-2 flex size-3.5 items-center justify-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="size-4"
          viewBox="0 0 24 24"
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
      </ComboboxPrimitive.ItemIndicator>
      <ComboboxPrimitive.ItemLabel>
        {local.children}
      </ComboboxPrimitive.ItemLabel>
    </ComboboxPrimitive.Item>
  )
}
