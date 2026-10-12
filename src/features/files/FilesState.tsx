import { TbAlertTriangle, TbFolderOff, TbRefresh } from "solid-icons/tb"
import { createSignal, onCleanup, Show, type JSX } from "solid-js"
import { Button } from "~/components/ui/button"
import { useT } from "~/hooks"
import { canRetry, classifyFilesError } from "./files-state"

/**
 * Three different outcomes get three different looks (loading skeleton lives
 * with the layouts): an error is never drawn as an empty folder.
 */
export const FilesError = (props: {
  msg: string
  onRetry: () => void
  actions?: JSX.Element
}) => {
  const t = useT()
  const kind = () => classifyFilesError(props.msg)
  return (
    <div
      role="alert"
      data-files-state="error"
      data-error-kind={kind()}
      class="flex w-full flex-col items-center gap-3 px-4 py-16 text-center"
    >
      <TbAlertTriangle class="size-10 text-destructive" />
      <div class="text-base font-medium">{t(`files.error.${kind()}`)}</div>
      <p class="m-0 max-w-prose break-words text-sm text-muted-foreground">
        {props.msg}
      </p>
      <div class="flex gap-2">
        <Show when={canRetry(kind())}>
          <Button
            variant="outline"
            class="gap-1.5"
            data-files-retry
            onClick={props.onRetry}
          >
            <TbRefresh class="size-4" />
            {t("files.retry")}
          </Button>
        </Show>
        {props.actions}
      </div>
    </div>
  )
}

export const FilesEmpty = () => {
  const t = useT()
  return (
    <div
      data-files-state="empty"
      class="flex w-full flex-col items-center gap-2 px-4 py-16 text-center text-muted-foreground"
    >
      <TbFolderOff class="size-10" />
      <div class="text-sm">{t("files.empty")}</div>
    </div>
  )
}

/** The list request has been pending this long (seconds) before the notice shows. */
export const SLOW_AFTER_S = 3
/** ...and this long before a retry is offered. */
export const RETRY_AFTER_S = 60

/**
 * Under the loading skeleton: a storage behind a rate limiter (115, say) can
 * queue a listing for a long time, so say so instead of looking frozen. It
 * only counts seconds; it sends no request and polls nothing. Mounted only
 * while the skeleton is, so it restarts for every load.
 */
export const SlowLoadNotice = (props: { onRetry: () => void }) => {
  const t = useT()
  const [secs, setSecs] = createSignal(0)
  const timer = setInterval(() => setSecs((n) => n + 1), 1000)
  onCleanup(() => clearInterval(timer))
  return (
    <Show when={secs() >= SLOW_AFTER_S}>
      <div
        data-files-state="slow"
        role="status"
        class="flex w-full items-center justify-center gap-3 px-4 py-3 text-sm text-muted-foreground"
      >
        <span data-slow-text>{t("files.slow", { n: secs() })}</span>
        <Show when={secs() >= RETRY_AFTER_S}>
          <Button
            variant="outline"
            class="gap-1.5"
            data-files-retry
            onClick={props.onRetry}
          >
            <TbRefresh class="size-4" />
            {t("files.retry")}
          </Button>
        </Show>
      </div>
    </Show>
  )
}
