import { useT } from "~/hooks"
import { Badge } from "~/components/ui/badge"
import type { TaskState } from "~/platform/contracts/task"
import { cn } from "~/utils/cn"

const TONE: Record<TaskState, string> = {
  queued: "bg-muted text-muted-foreground",
  running: "bg-primary/10 text-primary",
  waiting_retry: "bg-warning/15 text-warning",
  recovering: "bg-warning/15 text-warning",
  canceling: "bg-warning/15 text-warning",
  canceled: "bg-muted text-muted-foreground",
  failed: "bg-destructive/10 text-destructive",
  succeeded: "bg-success/15 text-success",
  partial_success: "bg-warning/15 text-warning",
}

export const StateBadge = (props: { state: TaskState; class?: string }) => {
  const t = useT()
  return (
    <Badge
      variant="secondary"
      data-state={props.state}
      class={cn("shrink-0 border-transparent", TONE[props.state], props.class)}
    >
      {t(`transfers.state.${props.state}`)}
    </Badge>
  )
}
