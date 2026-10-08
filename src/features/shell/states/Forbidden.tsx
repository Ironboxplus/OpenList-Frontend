import { TbLock } from "solid-icons/tb"
import { useRouter, useT } from "~/hooks"
import { Button } from "~/components/ui/button"
import { StatePage } from "./StatePage"

/** 403, or a signed-in user without the permission a page needs. */
export const Forbidden = (props: { fullscreen?: boolean }) => {
  const t = useT()
  const { to } = useRouter()
  return (
    <StatePage
      state="forbidden"
      fullscreen={props.fullscreen}
      icon={TbLock}
      title={t("states.forbidden.title")}
      description={t("states.forbidden.description")}
      actions={
        <>
          <Button variant="outline" onClick={() => window.history.back()}>
            {t("states.forbidden.back")}
          </Button>
          <Button onClick={() => to("/@login", true)}>
            {t("states.forbidden.switch_account")}
          </Button>
        </>
      }
    />
  )
}
