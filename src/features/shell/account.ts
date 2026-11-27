import { useRouter, useT } from "~/hooks"
import { revealFrom } from "~/platform/motion"
import { toggleColorMode } from "~/store/color-mode"
import type { Resp } from "~/types"
import { changeToken, handleResp, loginUrlFor, notify, r } from "~/utils"

/** Profile / logout / theme actions shared by the side nav and the tab bar. */
export const useAccountActions = () => {
  const t = useT()
  const { to } = useRouter()
  const logout = async () => {
    handleResp((await r.get("/auth/logout")) as Resp<unknown>, () => {
      changeToken()
      notify.success(t("manage.logout_success"))
      to(loginUrlFor(location))
    })
  }
  return {
    profile: () => to("/@manage/profile"),
    logout,
    // the new colors spread from the button pressed (P4)
    toggleTheme: (e?: Event) =>
      revealFrom(toggleColorMode, e?.currentTarget as Element | undefined),
  }
}
