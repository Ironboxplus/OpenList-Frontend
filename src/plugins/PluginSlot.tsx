import { For } from "solid-js"
import { Dynamic } from "solid-js/web"
import { slotComponents, type SlotName } from "./registry"

/**
 * Renders every plugin component contributed to the named slot, in order.
 * Reactive: re-renders when plugins are registered/unregistered/toggled.
 */
export const PluginSlot = (props: { name: SlotName }) => {
  return (
    <For each={slotComponents(props.name)}>
      {(c) => <Dynamic component={c.component} />}
    </For>
  )
}
