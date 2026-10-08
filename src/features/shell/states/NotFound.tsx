import { TbCompass } from "solid-icons/tb"
import { useRouter, useT } from "~/hooks"
import { Button } from "~/components/ui/button"
import { StatePage } from "./StatePage"

/** Unknown route. Business-level 404s (missing file) stay with their page. */
export const NotFound = (props: { fullscreen?: boolean }) => {
  const t = useT()
  const { to } = useRouter()
  return (
    <StatePage
      state="not-found"
      fullscreen={props.fullscreen}
      icon={TbCompass}
      title={t("states.not_found.title")}
      description={t("states.not_found.description")}
      actions={
        <Button onClick={() => to("/")}>{t("states.not_found.action")}</Button>
      }
    />
  )
}
