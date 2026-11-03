import { For, Show } from "solid-js"
import {
  DropdownMenuGroup,
  DropdownMenuGroupLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
} from "./dropdown-menu"

const DEFAULT_KEY = "__default"

export interface SortOption {
  key: string
  label: string
}

/**
 * The body of a sort dropdown: one radio group for the key and one for the
 * direction. Callers bring their own trigger (an icon button in a TopBar, a
 * labelled button in a toolbar) and their own sort state.
 */
export const SortMenuItems = (props: {
  options: SortOption[]
  /** The active key; absent means the default order is in effect. */
  value?: string
  reverse: boolean
  labels: { by: string; asc: string; desc: string }
  onChange: (key: string | undefined, reverse: boolean) => void
  /** A first radio item that is active while `value` is absent; picking it calls `onReset`. */
  defaultLabel?: string
  onReset?: () => void
}) => (
  <>
    <DropdownMenuGroup>
      <DropdownMenuGroupLabel class="px-2 py-1 text-xs text-muted-foreground">
        {props.labels.by}
      </DropdownMenuGroupLabel>
      <DropdownMenuRadioGroup
        value={props.value ?? (props.defaultLabel ? DEFAULT_KEY : undefined)}
        onChange={(key) =>
          key === DEFAULT_KEY
            ? props.onReset?.()
            : props.onChange(key, props.reverse)
        }
      >
        <Show when={props.defaultLabel}>
          <DropdownMenuRadioItem
            value={DEFAULT_KEY}
            data-sort-key="default"
            closeOnSelect
          >
            {props.defaultLabel}
          </DropdownMenuRadioItem>
        </Show>
        <For each={props.options}>
          {(o) => (
            <DropdownMenuRadioItem
              value={o.key}
              data-sort-key={o.key}
              closeOnSelect
            >
              {o.label}
            </DropdownMenuRadioItem>
          )}
        </For>
      </DropdownMenuRadioGroup>
    </DropdownMenuGroup>
    <DropdownMenuSeparator />
    <DropdownMenuRadioGroup
      value={props.reverse ? "desc" : "asc"}
      onChange={(d) => props.onChange(props.value, d === "desc")}
    >
      <DropdownMenuRadioItem value="asc" data-sort-dir="asc" closeOnSelect>
        {props.labels.asc}
      </DropdownMenuRadioItem>
      <DropdownMenuRadioItem value="desc" data-sort-dir="desc" closeOnSelect>
        {props.labels.desc}
      </DropdownMenuRadioItem>
    </DropdownMenuRadioGroup>
  </>
)
