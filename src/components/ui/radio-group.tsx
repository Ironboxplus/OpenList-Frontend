// Kobalte's RadioGroup styled as the kit's Checkbox (same border, ring and
// disabled look; the shadcn-solid radio-group has the same structure). Added
// for the pages that left hope-ui (P5, docs/FE_HOPE_TOKEN_MAP.md).
import * as RadioGroupPrimitive from "@kobalte/core/radio-group"
import { type JSX, For } from "solid-js"
import { cn } from "~/utils/cn"

export interface RadioOption {
  value: string
  label: JSX.Element
  disabled?: boolean
}

/**
 * A group of radios from a list of `{ value, label }`: pass the options and
 * `onChange` (it gets the chosen value). Uncontrolled with `defaultValue`,
 * controlled with `value`.
 */
export const RadioGroupField = (props: {
  options: RadioOption[]
  value?: string
  defaultValue?: string
  onChange?: (value: string) => void
  disabled?: boolean
  name?: string
  /** Layout of the options: a row by default. */
  class?: string
  "aria-label"?: string
  "data-testid"?: string
}) => (
  <RadioGroupPrimitive.Root
    value={props.value}
    defaultValue={props.defaultValue}
    onChange={props.onChange}
    disabled={props.disabled}
    name={props.name}
    aria-label={props["aria-label"]}
    data-testid={props["data-testid"]}
  >
    <div
      class={cn(
        "flex flex-row flex-wrap items-center gap-x-4 gap-y-2",
        props.class,
      )}
    >
      <For each={props.options}>
        {(o) => (
          <RadioGroupPrimitive.Item
            value={o.value}
            disabled={o.disabled}
            class="flex items-center gap-2 text-sm"
          >
            <RadioGroupPrimitive.ItemInput class="[&:focus-visible+div]:ring-[1.5px] [&:focus-visible+div]:ring-ring [&:focus-visible+div]:ring-offset-2 [&:focus-visible+div]:ring-offset-background" />
            <RadioGroupPrimitive.ItemControl class="flex size-4 shrink-0 items-center justify-center rounded-full border border-primary shadow outline-none! data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50">
              <RadioGroupPrimitive.ItemIndicator class="size-2 rounded-full bg-primary" />
            </RadioGroupPrimitive.ItemControl>
            <RadioGroupPrimitive.ItemLabel class="cursor-pointer data-[disabled]:cursor-not-allowed">
              {o.label}
            </RadioGroupPrimitive.ItemLabel>
          </RadioGroupPrimitive.Item>
        )}
      </For>
    </div>
  </RadioGroupPrimitive.Root>
)
