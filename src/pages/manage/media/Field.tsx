import { type JSX, Show } from "solid-js"

/** A label above a control, with the hint under it. */
export const Field = (props: {
  label: string
  help?: string
  children: JSX.Element
}) => (
  <label class="flex flex-col gap-1.5 text-sm">
    <span class="font-medium">{props.label}</span>
    {props.children}
    <Show when={props.help}>
      <span class="text-xs text-muted-foreground">{props.help}</span>
    </Show>
  </label>
)
