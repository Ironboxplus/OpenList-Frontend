import { TbServerOff } from "solid-icons/tb"
import { Show } from "solid-js"
import { useT } from "~/hooks"
import { Button } from "~/components/ui/button"
import { StatePage } from "./StatePage"

export interface BackendError {
  code?: string
  requestId?: string
}

/** Startup request failed (network, timeout, 5xx): the server is not answering. */
export const BackendUnavailable = (props: {
  error?: BackendError
  onRetry: () => void
  retrying?: boolean
  fullscreen?: boolean
}) => {
  const t = useT()
  const hasDetails = () => !!(props.error?.code || props.error?.requestId)
  return (
    <StatePage
      state="backend-unavailable"
      fullscreen={props.fullscreen}
      icon={TbServerOff}
      title={t("states.backend.title")}
      description={t("states.backend.description")}
      details={
        hasDetails() ? (
          <>
            <Show when={props.error?.code}>
              <div>
                {t("errors.error_code")}: {props.error!.code}
              </div>
            </Show>
            <Show when={props.error?.requestId}>
              <div>
                {t("errors.request_id")}: {props.error!.requestId}
              </div>
            </Show>
          </>
        ) : undefined
      }
      actions={
        <Button disabled={props.retrying} onClick={() => props.onRetry()}>
          {t("states.retry")}
        </Button>
      }
    />
  )
}
