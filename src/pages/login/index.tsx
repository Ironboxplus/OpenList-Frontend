import { useColorModeValue } from "@hope-ui/solid"
import { createMemo, createSignal, Show, onMount, onCleanup } from "solid-js"
import { SwitchColorMode, SwitchLanguageWhite } from "~/components"
import { useFetch, useLoading, useT, useTitle, useRouter } from "~/hooks"
import {
  changeToken,
  r,
  notify,
  handleRespWithoutAuthAndNotify,
  base_path,
  handleResp,
  hashPwd,
  resolveRedirect,
} from "~/utils"
import { PResp, Resp } from "~/types"
import { createStorageSignal } from "@solid-primitives/storage"
import { getSetting, getSettingBool } from "~/store"
import { SSOLogin } from "./SSOLogin"
import { IoFingerPrint } from "solid-icons/io"
import { Button } from "~/components/ui/button"
import { Card } from "~/components/ui/card"
import {
  Checkbox,
  CheckboxControl,
  CheckboxLabel,
} from "~/components/ui/checkbox"
import { Input } from "~/components/ui/input"
const supported = () =>
  !!globalThis.PublicKeyCredential?.parseRequestOptionsFromJSON

const Login = () => {
  const logos = getSetting("logo").split("\n")
  const logo = useColorModeValue(logos[0], logos.pop())
  const t = useT()
  const title = createMemo(() => {
    return `${t("login.login_to")} ${getSetting("site_title")}`
  })
  useTitle(title)
  const [username, setUsername] = createSignal(
    localStorage.getItem("username") || "",
  )
  const [password, setPassword] = createSignal(
    localStorage.getItem("password") || "",
  )
  const [opt, setOpt] = createSignal("")
  const [useauthn, setuseauthn] = createSignal(false)
  const [remember, setRemember] = createStorageSignal("remember-pwd", "false")
  const [useLdap, setUseLdap] = createSignal(false)
  const [loading, data] = useLoading(
    async (): Promise<Resp<{ token: string }>> => {
      if (useLdap()) {
        return r.post("/auth/login/ldap", {
          username: username(),
          password: password(),
          otp_code: opt(),
        })
      } else {
        return r.post("/auth/login/hash", {
          username: username(),
          password: hashPwd(password()),
          otp_code: opt(),
        })
      }
    },
  )
  const [, postauthnlogin] = useFetch(
    (
      session: string,
      credentials: PublicKeyCredential,
      username: string,
      signal: AbortSignal | undefined,
    ): Promise<Resp<{ token: string }>> =>
      r.post(
        "/authn/webauthn_finish_login?username=" + username,
        JSON.stringify(credentials.toJSON()),
        {
          headers: {
            session: session,
          },
          signal,
        },
      ),
  )
  interface WebAuthnTemp {
    session: string
    options: { publicKey: PublicKeyCredentialRequestOptionsJSON }
  }
  const [, getauthntemp] = useFetch(
    (username, signal: AbortSignal | undefined): PResp<WebAuthnTemp> =>
      r.get("/authn/webauthn_begin_login?username=" + username, {
        signal,
      }),
  )
  const { searchParams, to } = useRouter()
  // The 401 handler stores the full location (path, query, hash) here.
  const restoreRedirect = () =>
    resolveRedirect(searchParams.redirect, base_path || "/")
  const isAuthnConditionalAvailable = async (): Promise<boolean> => {
    if (
      PublicKeyCredential &&
      "isConditionalMediationAvailable" in PublicKeyCredential
    ) {
      return await PublicKeyCredential.isConditionalMediationAvailable()
    } else {
      return false
    }
  }
  const AuthnSignEnabled = getSettingBool("webauthn_login_enabled")
  const AuthnSwitch = async () => {
    setuseauthn(!useauthn())
  }
  let AuthnSignal: AbortController | null = null
  const AuthnLogin = async (conditional?: boolean) => {
    if (!supported()) {
      if (!conditional) {
        notify.error(t("users.webauthn_not_supported"))
      }
      return
    }
    if (conditional && !(await isAuthnConditionalAvailable())) {
      return
    }
    AuthnSignal?.abort()
    const controller = new AbortController()
    AuthnSignal = controller
    const username_login: string = conditional ? "" : username()
    if (!conditional && remember() === "true") {
      localStorage.setItem("username", username())
    } else {
      localStorage.removeItem("username")
    }
    const resp = await getauthntemp(username_login, controller.signal)
    handleResp(resp, async (data) => {
      try {
        const requestOptions: CredentialRequestOptions = {
          publicKey: PublicKeyCredential.parseRequestOptionsFromJSON(
            data.options.publicKey,
          ),
          signal: controller.signal,
        }
        if (conditional) {
          requestOptions.mediation = "conditional"
        }
        const credentials = (await navigator.credentials.get(
          requestOptions,
        )) as PublicKeyCredential
        const resp = await postauthnlogin(
          data.session,
          credentials,
          username_login,
          controller.signal,
        )
        handleRespWithoutAuthAndNotify(
          resp,
          (data) => {
            notify.success(t("login.success"))
            changeToken(data.token)
            to(restoreRedirect(), true)
          },
          (msg) => {
            notify.error(msg)
          },
        )
      } catch (error: unknown) {
        if (error instanceof Error && error.name != "AbortError")
          notify.error(error.message)
      }
    })
  }
  const AuthnCleanUpHandler = () => AuthnSignal?.abort()
  onMount(() => {
    if (AuthnSignEnabled) {
      window.addEventListener("beforeunload", AuthnCleanUpHandler)
      AuthnLogin(true)
    }
  })
  onCleanup(() => {
    AuthnSignal?.abort()
    window.removeEventListener("beforeunload", AuthnCleanUpHandler)
  })

  const Login = async () => {
    if (loading()) return

    if (!useauthn()) {
      if (remember() === "true") {
        localStorage.setItem("username", username())
        localStorage.setItem("password", password())
      } else {
        localStorage.removeItem("username")
        localStorage.removeItem("password")
      }
      const resp = await data()
      handleRespWithoutAuthAndNotify(
        resp,
        (data) => {
          notify.success(t("login.success"))
          changeToken(data.token)
          to(restoreRedirect(), true)
        },
        (msg, code) => {
          if (!needOpt() && code === 402) {
            setNeedOpt(true)
          } else {
            notify.error(msg)
          }
        },
      )
    } else {
      await AuthnLogin()
    }
  }
  const [needOpt, setNeedOpt] = createSignal(false)
  const ldapLoginEnabled = getSettingBool("ldap_login_enabled")
  const ldapLoginTips = getSetting("ldap_login_tips")
  if (ldapLoginEnabled) {
    setUseLdap(true)
  }

  return (
    <div class="fixed inset-0 z-10 flex items-center justify-center overflow-auto bg-muted p-4">
      <Card class="flex w-full max-w-[380px] flex-col gap-4 p-6">
        <div class="flex items-center justify-center gap-3">
          <img class="size-12" src={logo()} alt="" />
          <h1 class="m-0 text-xl font-semibold">{title()}</h1>
        </div>
        <Show
          when={!needOpt()}
          fallback={
            <Input
              id="totp"
              name="otp"
              placeholder={t("login.otp-tips")}
              value={opt()}
              onInput={(e) => {
                const code = e.currentTarget.value
                setOpt(code)
                if (/^\d{6}$/.test(code)) {
                  void Login()
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  Login()
                }
              }}
            />
          }
        >
          <Input
            name="username"
            autocomplete="username"
            placeholder={t("login.username-tips")}
            value={username()}
            onInput={(e) => setUsername(e.currentTarget.value)}
          />
          <Show when={!useauthn()}>
            <Input
              name="password"
              autocomplete="current-password"
              placeholder={t("login.password-tips")}
              type="password"
              value={password()}
              onInput={(e) => setPassword(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  Login()
                }
              }}
            />
          </Show>
          <div class="flex items-center justify-between text-sm text-muted-foreground">
            <Checkbox
              class="flex items-center gap-2"
              checked={remember() === "true"}
              onChange={(on) => setRemember(on ? "true" : "false")}
            >
              <CheckboxControl />
              <CheckboxLabel>{t("login.remember")}</CheckboxLabel>
            </Checkbox>
            <a target="_blank" href={t("login.forget_url")}>
              {t("login.forget")}
            </a>
          </div>
        </Show>
        <Button class="w-full" disabled={loading()} onClick={Login}>
          {t("login.login")}
        </Button>
        <Show when={ldapLoginEnabled}>
          <Checkbox
            class="flex items-center gap-2 text-sm"
            checked={useLdap() === true}
            onChange={setUseLdap}
          >
            <CheckboxControl />
            <CheckboxLabel>{ldapLoginTips}</CheckboxLabel>
          </Checkbox>
        </Show>
        <Button
          class="w-full"
          variant="secondary"
          onClick={() => {
            changeToken()
            to(restoreRedirect(), true)
          }}
        >
          {t("login.use_guest")}
        </Button>
        <div class="flex items-center justify-evenly pt-1 text-muted-foreground">
          <SwitchLanguageWhite />
          <SwitchColorMode />
          <SSOLogin />
          <Show when={AuthnSignEnabled}>
            <button
              type="button"
              aria-label="WebAuthn"
              class="bg-transparent p-0.5 text-inherit"
              onClick={AuthnSwitch}
            >
              <IoFingerPrint class="size-8" />
            </button>
          </Show>
        </div>
      </Card>
    </div>
  )
}

export default Login
