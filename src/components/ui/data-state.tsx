import { TbAlertCircle, TbRefresh } from "solid-icons/tb"
import { type JSX, Match, Show, Switch } from "solid-js"
import { Skeleton } from "~/components/ui/skeleton"
import { focusRing } from "~/components/ui/focus"
import { useT } from "~/hooks"
import { cn } from "~/utils/cn"

/** The outlined "Retry"-style button of a failed load (also used by the files page). */
export const retryButtonClass = cn(
  focusRing,
  "inline-flex h-9 items-center gap-1.5 rounded-lg border bg-background px-3 text-sm font-medium text-foreground hover:bg-accent",
)

export interface DataStateProps {
  loading?: boolean
  /** Message of a failed load; shown with a Retry button. */
  error?: string
  empty?: boolean
  emptyText?: string
  /** Extra content under the empty text (e.g. a create button). */
  emptyAction?: JSX.Element
  onRetry?: () => void
  /** Rows of the loading placeholder. */
  skeletonRows?: number
  children: JSX.Element
}

/**
 * The non-happy states of any fetched view, in one place: loading
 * (placeholder rows), failed (message and Retry) and empty. Data that is
 * already there stays on screen while a refresh runs. Same look as the
 * shell's state pages: a muted icon disc, short text, one action.
 */
export const DataState = (props: DataStateProps) => {
  const t = useT()
  return (
    <Switch fallback={props.children}>
      <Match when={props.error}>
        <div
          role="alert"
          data-state="error"
          class="flex flex-col items-center gap-3 rounded-xl border bg-card px-4 py-8 text-center"
        >
          <span class="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <TbAlertCircle class="size-6" />
          </span>
          <p class="max-w-prose break-all text-sm text-muted-foreground">
            {props.error}
          </p>
          <Show when={props.onRetry}>
            <button
              type="button"
              class={retryButtonClass}
              onClick={() => props.onRetry?.()}
            >
              <TbRefresh class="size-4" />
              {t("common.retry")}
            </button>
          </Show>
        </div>
      </Match>
      <Match when={props.loading && props.empty !== false}>
        <div data-state="loading" class="flex flex-col gap-2" aria-busy="true">
          {Array.from({ length: props.skeletonRows ?? 3 }, () => (
            <Skeleton class="h-12 w-full" />
          ))}
        </div>
      </Match>
      <Match when={props.empty}>
        <div
          data-state="empty"
          class="flex flex-col items-center gap-3 py-10 text-center text-sm text-muted-foreground"
        >
          <p>{props.emptyText ?? t("common.empty")}</p>
          {props.emptyAction}
        </div>
      </Match>
    </Switch>
  )
}
