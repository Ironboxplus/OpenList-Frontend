import type { IconTypes } from "solid-icons"
import { TbChevronRight } from "solid-icons/tb"
import type { JSX } from "solid-js"
import { Card } from "~/components/ui/card"
import { focusRing } from "~/components/ui/focus"
import { useT } from "~/hooks"
import { cn } from "~/utils/cn"

/** One read-only card: a title row that opens the full view, then the content. */
export const DashboardCard = (props: {
  title: string
  icon: IconTypes
  onOpen: () => void
  testid: string
  children: JSX.Element
}) => {
  const t = useT()
  return (
    <Card data-testid={props.testid} class="flex flex-col gap-3 p-4">
      <button
        type="button"
        aria-label={`${t("dashboard.open")}: ${props.title}`}
        onClick={props.onOpen}
        class={cn(
          focusRing,
          "flex items-center gap-2 rounded-md bg-transparent text-left text-sm font-semibold",
        )}
      >
        <props.icon class="size-4 text-muted-foreground" />
        <span class="flex-1">{props.title}</span>
        <TbChevronRight class="size-4 text-muted-foreground" />
      </button>
      {props.children}
    </Card>
  )
}
