import { Checkbox, CheckboxControl } from "~/components/ui/checkbox"
import { cn } from "~/utils/cn"

/**
 * The checkbox of a file row or card. Its click range reaches past the box
 * (the ::before), as hope's was; `stop` keeps the mouse down and the click from
 * reaching the row, whose own handlers would navigate or start a drag selection.
 */
export const ItemCheckbox = (props: {
  checked?: boolean
  indeterminate?: boolean
  onChange?: (checked: boolean) => void
  stop?: boolean
  class?: string
}) => (
  <Checkbox
    class={cn(
      "relative before:absolute before:-top-[10px] before:-right-[2px] before:-bottom-[10px] before:-left-[10px] before:content-['']",
      props.class,
    )}
    checked={props.checked}
    indeterminate={props.indeterminate}
    onChange={props.onChange}
    ref={(el: HTMLElement) => {
      if (!props.stop) return
      const stop = (e: Event) => e.stopPropagation()
      el.addEventListener("mousedown", stop)
      el.addEventListener("click", stop)
    }}
  >
    <CheckboxControl />
  </Checkbox>
)
