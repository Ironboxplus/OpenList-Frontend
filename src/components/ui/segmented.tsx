import { For } from "solid-js"
import { cn } from "~/utils/cn"
import { focusRing } from "./focus"

export interface Segment<K extends string> {
  value: K
  label: string
}

/**
 * One choice of a few, all in sight: joined buttons, the chosen one filled (a
 * radio group to assistive technology). For a short list that a dropdown would
 * only hide; each button carries `data-segment={value}`.
 */
export const Segmented = <K extends string>(props: {
  items: readonly Segment<K>[]
  value: K
  onChange: (value: K) => void
  label: string
  class?: string
  testid?: string
}) => (
  <div
    role="radiogroup"
    aria-label={props.label}
    data-testid={props.testid}
    class={cn(
      "inline-flex max-w-full flex-wrap rounded-md border bg-card p-0.5",
      props.class,
    )}
  >
    <For each={props.items}>
      {(item) => (
        <button
          type="button"
          role="radio"
          data-segment={item.value}
          aria-checked={props.value === item.value}
          class={cn(
            focusRing,
            "inline-flex h-7 shrink-0 items-center rounded-sm border-0 px-2.5 text-sm transition-colors",
            props.value === item.value
              ? "bg-primary text-primary-foreground"
              : "bg-transparent text-foreground hover:bg-accent",
          )}
          onClick={() => props.onChange(item.value)}
        >
          {item.label}
        </button>
      )}
    </For>
  </div>
)
