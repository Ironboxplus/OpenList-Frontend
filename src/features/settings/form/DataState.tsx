import { type JSX, Match, Show, Switch } from "solid-js"
import { Alert, AlertDescription } from "~/components/ui/alert"
import { Button } from "~/components/ui/button"
import { Skeleton } from "~/components/ui/skeleton"
import { useT } from "~/hooks"

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
 * The three non-happy states of any fetched view, in one place: loading
 * (placeholder rows), failed (message and Retry) and empty. Data that is
 * already there stays on screen while a refresh runs.
 */
export const DataState = (props: DataStateProps) => {
  const t = useT()
  return (
    <Switch fallback={props.children}>
      <Match when={props.error}>
        <Alert variant="destructive" data-state="error">
          <AlertDescription class="flex flex-wrap items-center justify-between gap-2">
            <span class="break-all">{props.error}</span>
            <Show when={props.onRetry}>
              <Button variant="outline" size="sm" onClick={props.onRetry}>
                {t("common.retry")}
              </Button>
            </Show>
          </AlertDescription>
        </Alert>
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
