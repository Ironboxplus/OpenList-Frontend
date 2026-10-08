import type { Component, JSX, ParentProps } from "solid-js"
import { Show } from "solid-js"
import { Dynamic } from "solid-js/web"
import { Card } from "~/components/ui/card"
import { cn } from "~/utils/cn"

export interface StatePageProps extends ParentProps {
  /** `data-state` hook for tests and browser checks. */
  state: string
  icon: Component<{ class?: string }>
  title: string
  description: string
  /** Small mono lines under the description (request id, error code). */
  details?: JSX.Element
  actions: JSX.Element
  /** Startup pages have no shell around them and fill the viewport. */
  fullscreen?: boolean
}

/** One centered card: icon, title, explanation, primary action. */
export const StatePage = (props: StatePageProps) => (
  <div
    data-state={props.state}
    class={cn(
      "flex w-full items-center justify-center p-4 sm:p-8",
      props.fullscreen ? "min-h-screen" : "min-h-[60vh]",
    )}
  >
    <Card class="flex w-full max-w-md flex-col items-center gap-4 p-6 text-center sm:p-8">
      <span class="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Dynamic component={props.icon} class="size-7" />
      </span>
      <div class="flex flex-col gap-1.5">
        <h1 class="text-lg font-semibold leading-tight text-foreground">
          {props.title}
        </h1>
        <p class="text-sm text-muted-foreground">{props.description}</p>
      </div>
      <Show when={props.details}>
        <div class="w-full rounded-md bg-muted px-3 py-2 text-left font-mono text-xs text-muted-foreground">
          {props.details}
        </div>
      </Show>
      <div class="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
        {props.actions}
      </div>
    </Card>
  </div>
)
