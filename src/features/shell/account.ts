import { useColorMode } from "@hope-ui/solid"
import { useRouter, useT } from "~/hooks"
import type { Resp } from "~/types"
import { changeToken, handleResp, notify, r } from "~/utils"

/** Profile / logout / theme actions shared by the side nav and the tab bar. */
export const useAccountActions = () => {
  const t = useT()
  const { to } = useRouter()
  const { toggleColorMode } = useColorMode()
  const logout = async () => {
    handleResp((await r.get("/auth/logout")) as Resp<unknown>, () => {
      changeToken()
      notify.success(t("manage.logout_success"))
      to(`/@login?redirect=${encodeURIComponent(location.pathname)}`)
    })
  }
  return {
    profile: () => to("/@manage"),
    logout,
    toggleTheme: toggleColorMode,
  }
}
