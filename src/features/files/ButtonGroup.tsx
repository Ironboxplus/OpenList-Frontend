import type { ParentProps } from "solid-js"
import { focusRing } from "~/components/ui/focus"
import { cn } from "~/utils/cn"

/** A bordered strip of buttons, like Cloudreve's action groups. */
export const ButtonGroup = (props: ParentProps<{ class?: string }>) => (
  <div
    class={cn(
      "inline-flex h-10 shrink-0 items-stretch divide-x divide-border overflow-hidden rounded-lg border bg-card",
      props.class,
    )}
  >
    {props.children}
  </div>
)

/** A button of a ButtonGroup: icon alone or icon and label. */
export const groupButton = cn(
  focusRing,
  "inline-flex min-w-10 items-center justify-center gap-1.5 bg-transparent px-3 text-sm text-foreground transition-colors hover:bg-accent disabled:opacity-40",
)
