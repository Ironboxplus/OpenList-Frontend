import { createSignal, Show } from "solid-js"
import { Badge } from "~/components/ui/badge"
import { useT } from "~/hooks"
import { cn } from "~/utils/cn"

/** `info` is for work in progress. */
export type StatusTone = "success" | "warning" | "error" | "neutral" | "info"

const VARIANT = {
  success: "success",
  warning: "warning",
  error: "destructive",
  neutral: "secondary",
  info: "info",
} as const

export interface StatusBadgeProps {
  tone: StatusTone
  label: string
  /** Long explanation (an error message): collapsed by default, expandable in full. */
  detail?: string
  class?: string
}

/**
 * A state chip. When a detail text comes with it (the reason a storage failed
 * to start, say) the chip carries a toggle that shows the whole message,
 * wrapped, instead of cutting it off.
 */
export const StatusBadge = (props: StatusBadgeProps) => {
  const t = useT()
  const [open, setOpen] = createSignal(false)
  return (
    <div
      data-status={props.tone}
      class={cn("flex min-w-0 flex-col items-start gap-1", props.class)}
    >
      <div class="flex items-center gap-1.5">
        <Badge variant={VARIANT[props.tone]}>{props.label}</Badge>
        <Show when={props.detail}>
          <button
            type="button"
            class="bg-transparent text-xs text-primary underline-offset-2 hover:underline"
            aria-expanded={open()}
            onClick={() => setOpen(!open())}
          >
            {open() ? t("common.hide_full") : t("common.show_full")}
          </button>
        </Show>
      </div>
      <Show when={open() && props.detail}>
        <pre
          data-testid="status-detail"
          class="max-h-60 w-full max-w-prose overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted p-2 font-mono text-xs"
        >
          {props.detail}
        </pre>
      </Show>
    </div>
  )
}
