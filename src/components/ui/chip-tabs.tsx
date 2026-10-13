import { For } from "solid-js"
import { cn } from "~/utils/cn"
import { focusRing } from "./focus"

export interface ChipItem<K extends string> {
  key: K
  label: string
}

/**
 * A row of filter chips (one is selected). Scrolls sideways on a phone, wraps
 * from `sm` up. Each chip carries `data-chip={key}`.
 */
export const ChipTabs = <K extends string>(props: {
  items: readonly ChipItem<K>[]
  value: K
  onChange: (key: K) => void
  label: string
}) => (
  <div
    class="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 [&::-webkit-scrollbar]:hidden"
    role="tablist"
    aria-label={props.label}
  >
    <For each={props.items}>
      {(item) => (
        <button
          type="button"
          role="tab"
          data-chip={item.key}
          aria-selected={props.value === item.key}
          class={cn(
            focusRing,
            "shrink-0 rounded-full border px-3 py-1 text-sm text-foreground transition-colors",
            props.value === item.key
              ? "border-primary bg-primary text-primary-foreground"
              : "bg-card hover:bg-accent",
          )}
          onClick={() => props.onChange(item.key)}
        >
          {item.label}
        </button>
      )}
    </For>
  </div>
)
