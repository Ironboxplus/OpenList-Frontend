import { createMemo } from "solid-js"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select"

export interface SimpleOption {
  value: string
  label: string
}

/**
 * A single-choice select over a flat list of `{ value, label }`, for the many
 * places that only need the kit look: pass the options, the value and onChange.
 */
export const SimpleSelect = (props: {
  options: SimpleOption[]
  value: string
  onChange: (value: string) => void
  class?: string
  "aria-label"?: string
  "data-testid"?: string
}) => {
  const labels = createMemo(
    () => new Map(props.options.map((o) => [o.value, o.label])),
  )
  return (
    <Select<string>
      options={props.options.map((o) => o.value)}
      value={props.value}
      onChange={(v) => v !== null && props.onChange(v)}
      disallowEmptySelection
      itemComponent={(p) => (
        <SelectItem item={p.item}>{labels().get(p.item.rawValue)}</SelectItem>
      )}
    >
      <SelectTrigger
        class={props.class}
        aria-label={props["aria-label"]}
        data-testid={props["data-testid"]}
      >
        <SelectValue<string>>
          {(s) => labels().get(s.selectedOption()) ?? s.selectedOption()}
        </SelectValue>
      </SelectTrigger>
      <SelectContent />
    </Select>
  )
}
