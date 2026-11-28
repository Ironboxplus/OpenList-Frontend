import { JSXElement, Match, Switch } from "solid-js"
import { getSetting } from "~/store"

export const Container = (props: { children: JSXElement }) => {
  const container = getSetting("home_container")
  return (
    <Switch
      fallback={<div class="mx-auto w-[min(99%,980px)]">{props.children}</div>}
    >
      <Match when={container === "hope_container"}>
        <div class="container mx-auto w-full">{props.children}</div>
      </Match>
    </Switch>
  )
}
