import { TbAlertTriangle, TbFolderOff, TbRefresh } from "solid-icons/tb"
import { Show, type JSX } from "solid-js"
import { focusRing } from "~/components/ui/focus"
import { useT } from "~/hooks"
import { cn } from "~/utils/cn"
import { canRetry, classifyFilesError } from "./files-state"

const retryButton = cn(
  focusRing,
  "inline-flex h-9 items-center gap-1.5 rounded-lg border bg-background px-3 text-sm font-medium text-foreground hover:bg-accent",
)

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
          <button
            type="button"
            data-files-retry
            class={retryButton}
            onClick={props.onRetry}
          >
            <TbRefresh class="size-4" />
            {t("files.retry")}
          </button>
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
