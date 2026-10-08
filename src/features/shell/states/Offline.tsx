import { TbWifiOff } from "solid-icons/tb"
import { onCleanup, onMount } from "solid-js"
import { useT } from "~/hooks"
import { Button } from "~/components/ui/button"
import { StatePage } from "./StatePage"

/**
 * The browser says it has no network. Retries by itself when the `online`
 * event fires; the button is for impatient users and for flaky `online` events.
 */
export const Offline = (props: {
  onRetry: () => void
  retrying?: boolean
  fullscreen?: boolean
}) => {
  const t = useT()
  const retry = () => props.onRetry()
  onMount(() => window.addEventListener("online", retry))
  onCleanup(() => window.removeEventListener("online", retry))
  return (
    <StatePage
      state="offline"
      fullscreen={props.fullscreen}
      icon={TbWifiOff}
      title={t("states.offline.title")}
      description={t("states.offline.description")}
      actions={
        <Button disabled={props.retrying} onClick={retry}>
          {t("states.retry")}
        </Button>
      }
    />
  )
}
