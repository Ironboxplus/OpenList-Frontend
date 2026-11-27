// Copied from shadcn-solid (hngngn/shadcn-solid) tag shadcn-solid@0.7.0
// (commit 08b8ce27d80b289fe983051a14541ff53e08d9cb), registry/frameworks/tailwindcss/.
// The CLI is not used offline-first; imports were adapted to this repo's alias.
import { cn } from "~/utils/cn"
import type { PolymorphicProps } from "@kobalte/core/polymorphic"
import * as SelectPrimitive from "@kobalte/core/select"
import type { ParentProps, ValidComponent } from "solid-js"
import { OverlayPresence, withRef } from "./overlay-presence"
import { splitProps } from "solid-js"

/** Mounted through its exit (overlay-presence.tsx): Kobalte keeps the list mounted. */
export const Select = ((props: any) => (
  <SelectPrimitive.Root forceMount {...props} />
)) as typeof SelectPrimitive.Root
export const SelectValue = SelectPrimitive.Value
export const SelectDescription = SelectPrimitive.Description
export const SelectErrorMessage = SelectPrimitive.ErrorMessage
export const SelectItemDescription = SelectPrimitive.ItemDescription
export const SelectHiddenSelect = SelectPrimitive.HiddenSelect
export const SelectSection = SelectPrimitive.Section

type SelectTriggerProps = ParentProps<
  SelectPrimitive.SelectTriggerProps & { class?: string }
>

export const SelectTrigger = <T extends ValidComponent = "button">(
  props: PolymorphicProps<T, SelectTriggerProps>,
) => {
  const [local, rest] = splitProps(props as SelectTriggerProps, [
    "class",
    "children",
  ])

  return (
    <SelectPrimitive.Trigger
      class={cn(
        "flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background transition-shadow placeholder:text-muted-foreground focus:outline-none focus-visible:ring-[1.5px] focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        local.class,
      )}
      {...rest}
    >
      {local.children}
      <SelectPrimitive.Icon
        as="svg"
        xmlns="http://www.w3.org/2000/svg"
        width="1em"
        height="1em"
        viewBox="0 0 24 24"
        class="size-4 opacity-50 flex items-center justify-center"
      >
        <path
          fill="none"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="m8 9l4-4l4 4m0 6l-4 4l-4-4"
        />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  )
}

type SelectContentProps = SelectPrimitive.SelectContentProps & {
  class?: string
  ref?: unknown
}

export const SelectContent = <T extends ValidComponent = "div">(
  props: PolymorphicProps<T, SelectContentProps>,
) => {
  const [local, rest] = splitProps(props as SelectContentProps, [
    "class",
    "ref",
  ])
  const list = SelectPrimitive.useSelectContext()

  return (
    <OverlayPresence open={list.isOpen} kind="select">
      {(ref) => (
        <SelectPrimitive.Portal>
          <SelectPrimitive.Content
            data-motion="select"
            ref={withRef(ref, local.ref)}
            class={cn(
              "relative z-[1500] min-w-[8rem] origin-[var(--kb-select-content-transform-origin)] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md",
              local.class,
            )}
            {...rest}
          >
            <SelectPrimitive.Listbox class="p-1 outline-none!" />
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      )}
    </OverlayPresence>
  )
}

type SelectItemProps = ParentProps<
  SelectPrimitive.SelectItemProps & { class?: string }
>

export const SelectItem = <T extends ValidComponent = "li">(
  props: PolymorphicProps<T, SelectItemProps>,
) => {
  const [local, rest] = splitProps(props as SelectItemProps, [
    "class",
    "children",
  ])

  return (
    <SelectPrimitive.Item
      class={cn(
        "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none! focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        local.class,
      )}
      {...rest}
    >
      <SelectPrimitive.ItemIndicator class="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-4 w-4"
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
      </SelectPrimitive.ItemIndicator>
      <SelectPrimitive.ItemLabel>{local.children}</SelectPrimitive.ItemLabel>
    </SelectPrimitive.Item>
  )
}
