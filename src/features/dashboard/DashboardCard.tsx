import type { IconTypes } from "solid-icons"
import { TbChevronRight } from "solid-icons/tb"
import { Show, type JSX } from "solid-js"
import { Card } from "~/components/ui/card"
import { focusRing } from "~/components/ui/focus"
import { useT } from "~/hooks"
import { cn } from "~/utils/cn"

/**
 * One read-only card: a title row (that opens the full view when it has one),
 * then the content.
 */
export const DashboardCard = (props: {
  title: string
  icon: IconTypes
  /** The "see all" target; without it the title is just a title. */
  onOpen?: () => void
  testid: string
  class?: string
  children: JSX.Element
}) => {
  const t = useT()
  const heading = (
    <>
      <props.icon class="size-4 text-muted-foreground" />
      <span class="flex-1">{props.title}</span>
    </>
  )
  return (
    <Card
      data-testid={props.testid}
      class={cn("flex min-w-0 flex-col gap-3 p-4", props.class)}
    >
      <Show
        when={props.onOpen}
        fallback={
          <div class="flex items-center gap-2 text-left text-sm font-semibold">
            {heading}
          </div>
        }
      >
        {(open) => (
          <button
            type="button"
            aria-label={`${t("dashboard.open")}: ${props.title}`}
            onClick={() => open()()}
            class={cn(
              focusRing,
              "flex min-h-8 items-center gap-2 rounded-md bg-transparent text-left text-sm font-semibold",
            )}
          >
            {heading}
            <TbChevronRight class="size-4 text-muted-foreground" />
          </button>
        )}
      </Show>
      {props.children}
    </Card>
  )
}
