import { Show } from "solid-js"
import { cn } from "~/utils/cn"
import { transfers } from "../transfers/service"

/**
 * Running-task count; turns into a red dot when there are failures the user
 * has not looked at yet.
 */
export const NavBadge = (props: { class?: string }) => {
  const count = () => transfers.activeCount()
  const failed = () => transfers.failedUnseenCount() > 0
  return (
    <Show when={failed() || count() > 0}>
      <span
        data-testid="transfer-badge"
        class={cn(
          "inline-flex items-center justify-center rounded-full text-[10px] font-semibold leading-none",
          failed()
            ? "size-2.5 bg-destructive"
            : "min-w-4 bg-primary px-1 py-0.5 text-primary-foreground",
          props.class,
        )}
        aria-label={failed() ? "failed" : String(count())}
      >
        {failed() ? "" : count() > 99 ? "99+" : count()}
      </span>
    </Show>
  )
}
