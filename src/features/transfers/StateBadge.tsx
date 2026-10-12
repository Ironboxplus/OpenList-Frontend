import { useT } from "~/hooks"
import { StatusBadge, type StatusTone } from "~/components/ui/status-badge"
import type { TaskState } from "~/platform/contracts/task"
import { cn } from "~/utils/cn"

/** How each task state reads on the shared badge scale. */
export const STATE_TONE: Record<TaskState, StatusTone> = {
  queued: "neutral",
  running: "info",
  waiting_retry: "warning",
  recovering: "warning",
  canceling: "warning",
  canceled: "neutral",
  failed: "error",
  succeeded: "success",
  partial_success: "warning",
}

export const StateBadge = (props: { state: TaskState; class?: string }) => {
  const t = useT()
  return (
    <StatusBadge
      tone={STATE_TONE[props.state]}
      label={t(`transfers.state.${props.state}`)}
      class={cn("shrink-0", props.class)}
    />
  )
}
