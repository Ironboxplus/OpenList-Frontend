// A checkbox or a switch with its label, for the many places that only need the
// kit look: the Kobalte parts (checkbox.tsx, switch.tsx) put together, `onChange`
// taking the new value. A page with its own layout of the parts uses them directly.
import { type JSX, Show } from "solid-js"
import { cn } from "~/utils/cn"
import {
  Checkbox,
  CheckboxControl,
  CheckboxLabel,
} from "~/components/ui/checkbox"
import {
  Switch,
  SwitchControl,
  SwitchLabel,
  SwitchThumb,
} from "~/components/ui/switch"

interface ToggleFieldProps {
  checked?: boolean
  onChange?: (checked: boolean) => void
  disabled?: boolean
  readOnly?: boolean
  name?: string
  value?: string
  id?: string
  class?: string
  title?: string
  "aria-label"?: string
  "data-testid"?: string
  /** The label; without it the control stands alone (give it an aria-label). */
  children?: JSX.Element
}

export const CheckboxField = (
  props: ToggleFieldProps & { indeterminate?: boolean },
) => (
  <Checkbox
    class={cn("flex items-center gap-2 text-sm", props.class)}
    checked={props.checked}
    indeterminate={props.indeterminate}
    onChange={props.onChange}
    disabled={props.disabled}
    readOnly={props.readOnly}
    name={props.name}
    value={props.value}
    id={props.id}
    title={props.title}
    aria-label={props["aria-label"]}
    data-testid={props["data-testid"]}
  >
    <CheckboxControl />
    <Show when={props.children}>
      <CheckboxLabel>{props.children}</CheckboxLabel>
    </Show>
  </Checkbox>
)

export const SwitchField = (props: ToggleFieldProps) => (
  <Switch
    class={cn("flex items-center gap-2 text-sm", props.class)}
    checked={props.checked}
    onChange={props.onChange}
    disabled={props.disabled}
    readOnly={props.readOnly}
    name={props.name}
    value={props.value}
    id={props.id}
    title={props.title}
    aria-label={props["aria-label"]}
    data-testid={props["data-testid"]}
  >
    <SwitchControl>
      <SwitchThumb />
    </SwitchControl>
    <Show when={props.children}>
      <SwitchLabel>{props.children}</SwitchLabel>
    </Show>
  </Switch>
)
