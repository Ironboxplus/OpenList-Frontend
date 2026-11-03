import { FiGithub, FiLogIn } from "solid-icons/fi"
import { BsMicrosoft } from "solid-icons/bs"
import { AiOutlineGoogle, AiOutlineDingtalk } from "solid-icons/ai"
import { base_path, changeToken, r } from "~/utils"
import { getSetting, getSettingBool } from "~/store"
import { useRouter, useT } from "~/hooks"
import { Button } from "~/components/ui/button"
import { onCleanup } from "solid-js"
import { Dynamic } from "solid-js/web"

const SSOLogin = () => {
  const t = useT()
  const ssoSignEnabled = getSettingBool("sso_login_enabled")
  const loginPlatform = getSetting("sso_login_platform")
  const useCompatibility = getSettingBool("sso_compatibility_mode")
  const { searchParams, to } = useRouter()
  const token = searchParams["token"]
  if (token != undefined && token != "") {
    changeToken(token)
    to(decodeURIComponent(searchParams.redirect || base_path || "/"), true)
  }
  function messageEvent(event: MessageEvent) {
    const data = event.data
    if (data.token) {
      changeToken(data.token)
      to(decodeURIComponent(searchParams.redirect || base_path || "/"), true)
    }
  }
  window.addEventListener("message", messageEvent)
  onCleanup(() => {
    window.removeEventListener("message", messageEvent)
  })
  if (ssoSignEnabled) {
    const login = () => {
      const url = r.getUri() + "/auth/sso?method=sso_get_token"
      if (useCompatibility) {
        window.location.href = url
        return
      }
      window.open(url, "authPopup", "width=500,height=600")
    }
    let icon
    switch (loginPlatform) {
      case "Github":
        icon = FiGithub
        break
      case "Microsoft":
        icon = BsMicrosoft
        break
      case "Google":
        icon = AiOutlineGoogle
        break
      case "Dingtalk":
        icon = AiOutlineDingtalk
        break
      default:
        icon = FiLogIn
    }
    return (
      <Button
        variant="ghost"
        size="icon"
        title={t("login.sso")}
        aria-label={t("login.sso")}
        onClick={login}
      >
        <Dynamic component={icon} class="size-5" />
      </Button>
    )
  }
}

export { SSOLogin }
