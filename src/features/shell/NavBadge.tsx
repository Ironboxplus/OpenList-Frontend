import { Show } from "solid-js"
import { cn } from "~/utils/cn"
import { transfers } from "../transfers/service"

/**
 * A small count pill, or a bare dot when `dot` is set. The shell's badges
 * (running tasks, unread errors) are all drawn by this one.
 */
export const CountBadge = (props: {
  count: number
  dot?: boolean
  label?: string
  class?: string
  testid?: string
}) => (
  <Show when={props.dot || props.count > 0}>
    <span
      data-testid={props.testid}
      class={cn(
        "inline-flex items-center justify-center rounded-full text-[10px] font-semibold leading-none",
        props.dot
          ? "size-2.5 bg-destructive"
          : "min-w-4 bg-primary px-1 py-0.5 text-primary-foreground",
        props.class,
      )}
      aria-label={props.label ?? (props.dot ? "failed" : String(props.count))}
    >
      {props.dot ? "" : props.count > 99 ? "99+" : props.count}
    </span>
  </Show>
)

/**
 * Running-task count; turns into a red dot when there are failures the user
 * has not looked at yet.
 */
export const NavBadge = (props: { class?: string }) => (
  <CountBadge
    testid="transfer-badge"
    count={transfers.activeCount()}
    dot={transfers.failedUnseenCount() > 0}
    class={props.class}
  />
)
