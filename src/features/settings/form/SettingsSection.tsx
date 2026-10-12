import { type JSX, Show } from "solid-js"
import { Card } from "~/components/ui/card"
import { cn } from "~/utils/cn"

export interface SettingsSectionProps {
  title: string
  description?: string
  /** Buttons that belong to the whole card (right of the title). */
  actions?: JSX.Element
  children: JSX.Element
  class?: string
  /** Stable hook for tests and in-page links. */
  id?: string
}

/**
 * One card of a settings page: a title, what it is for, then its fields as a
 * list of rows. Pages stack several of these; the page-wide Save / Reset bar
 * belongs to SettingsForm, not to a card.
 */
export const SettingsSection = (props: SettingsSectionProps) => (
  <Card
    id={props.id}
    data-section={props.id}
    class={cn("flex flex-col", props.class)}
  >
    <header class="flex flex-wrap items-start justify-between gap-2 px-4 pb-1 pt-4 sm:px-6 sm:pt-5">
      <div class="min-w-0">
        <h2 class="text-base font-semibold leading-tight">{props.title}</h2>
        <Show when={props.description}>
          <p class="mt-1 text-sm text-muted-foreground">{props.description}</p>
        </Show>
      </div>
      <Show when={props.actions}>
        <div class="flex shrink-0 items-center gap-2">{props.actions}</div>
      </Show>
    </header>
    <div class="flex flex-col divide-y px-4 pb-2 sm:px-6">{props.children}</div>
  </Card>
)
