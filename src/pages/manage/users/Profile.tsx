import { createSignal, For, onCleanup, Show } from "solid-js"
import { LinkWithBase } from "~/components"
import { Alert, AlertDescription } from "~/components/ui/alert"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { FieldRenderer, SettingsSection } from "~/features/settings/form"
import { useFetch, useManageTitle, useRouter, useT } from "~/hooks"
import { getSettingBool, me, setMe } from "~/store"
import { PEmptyResp, Type, UserMethods, UserPermissions } from "~/types"
import { handleResp, loginUrlFor, notify, r } from "~/utils"
import { PublicKeys } from "./PublicKeys"
import { Sessions } from "./Sessions"
import { WebauthnCredentials } from "./Webauthnitems"

const Profile = () => {
  const t = useT()
  useManageTitle("manage.sidemenu.profile")
  const { searchParams, to } = useRouter()
  const [username, setUsername] = createSignal(me().username)
  const [password, setPassword] = createSignal("")
  const [confirmPassword, setConfirmPassword] = createSignal("")
  const usecompatibility = getSettingBool("sso_compatibility_mode")
  const [loading, save] = useFetch((ssoID?: boolean): PEmptyResp =>
    r.post("/me/update", {
      username: ssoID ? me().username : username(),
      password: ssoID ? "" : password(),
      sso_id: me().sso_id,
    }),
  )

  const saveMe = async (ssoID?: boolean) => {
    if (password() && password() !== confirmPassword()) {
      notify.warning(t("users.confirm_password_not_same"))
      return
    }
    handleResp(await save(ssoID), () => {
      setMe({ ...me(), username: username() })
      if (!ssoID) {
        notify.success(t("users.update_profile_success"))
        // The session ends with a credential change: sign in again.
        to(loginUrlFor(location))
      } else {
        to("")
      }
    })
  }

  // Returning from the SSO provider, by redirect or by popup message.
  const ssoID = searchParams["sso_id"]
  if (ssoID) {
    setMe({ ...me(), sso_id: ssoID })
    saveMe(true)
  }
  const onMessage = (event: MessageEvent) => {
    const data = event.data
    if (data.sso_id) {
      setMe({ ...me(), sso_id: data.sso_id })
      saveMe(true)
    }
  }
  window.addEventListener("message", onMessage)
  onCleanup(() => window.removeEventListener("message", onMessage))

  const connectSso = () => {
    const url = r.getUri() + "/auth/sso?method=get_sso_id"
    if (usecompatibility) {
      window.location.href = url
      return
    }
    window.open(url, "authPopup", "width=500,height=600")
  }

  return (
    <div class="flex w-full flex-col gap-4">
      <Show
        when={!UserMethods.is_guest(me())}
        fallback={
          <>
            <Alert variant="warning">
              <AlertDescription>
                <span class="font-medium">{t("users.guest-tips")}</span>{" "}
                {t("users.modify_nothing")}
              </AlertDescription>
            </Alert>
            <p class="text-sm">
              {t("global.have_account")}{" "}
              <LinkWithBase
                class="text-primary underline"
                href={loginUrlFor(location)}
              >
                {t("global.go_login")}
              </LinkWithBase>
            </p>
          </>
        }
      >
        {/* Editing your own username/password requires the manage-user-info
            permission (admins always have it). Without it, the fields are hidden
            and the backend rejects the change too. 2FA stays available below. */}
        <SettingsSection
          id="profile-account"
          title={t("users.update_profile")}
          actions={
            <Show when={UserMethods.can_manage_user_info(me())}>
              <Button
                type="button"
                disabled={loading()}
                onClick={() => saveMe(false)}
              >
                {t("global.save")}
              </Button>
            </Show>
          }
        >
          <Show
            when={UserMethods.can_manage_user_info(me())}
            fallback={
              <p class="py-3 text-sm text-muted-foreground">
                {t("users.no_modify_permission")}
              </p>
            }
          >
            <FieldRenderer
              field={{
                id: "username",
                type: Type.String,
                labelKey: "users.change_username",
              }}
              value={username()}
              onChange={(raw) => setUsername(String(raw))}
            />
            <FieldRenderer
              field={{
                id: "password",
                type: Type.String,
                labelKey: "users.change_password",
                helpKey: "users.change_password-tips",
                secret: true,
                placeholder: "********",
              }}
              value={password()}
              onChange={(raw) => setPassword(String(raw))}
            />
            <FieldRenderer
              field={{
                id: "confirm-password",
                type: Type.String,
                labelKey: "users.confirm_password",
                helpKey: "users.confirm_password-tips",
                secret: true,
                placeholder: "********",
              }}
              value={confirmPassword()}
              onChange={(raw) => setConfirmPassword(String(raw))}
            />
          </Show>
          <Show when={!me().otp}>
            <div class="py-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => to("/@manage/2fa")}
              >
                {t("users.enable_2fa")}
              </Button>
            </div>
          </Show>
        </SettingsSection>

        <Show when={getSettingBool("sso_login_enabled")}>
          <SettingsSection id="profile-sso" title={t("users.sso_login")}>
            <div class="py-3">
              <Show
                when={me().sso_id}
                fallback={
                  <Button type="button" onClick={connectSso}>
                    {t("users.connect_sso")}
                  </Button>
                }
              >
                <Button
                  type="button"
                  variant="destructive"
                  disabled={loading()}
                  onClick={() => {
                    setMe({ ...me(), sso_id: "" })
                    saveMe(true)
                  }}
                >
                  {t("users.disconnect_sso")}
                </Button>
              </Show>
            </div>
          </SettingsSection>
        </Show>

        <Show when={getSettingBool("webauthn_login_enabled")}>
          <section class="flex flex-col gap-2" data-section="webauthn">
            <h2 class="text-base font-semibold">{t("users.webauthn")}</h2>
            <WebauthnCredentials />
          </section>
        </Show>
      </Show>

      <SettingsSection id="profile-permissions" title={t("users.permission")}>
        <div class="flex flex-wrap gap-2 py-3">
          <For each={UserPermissions}>
            {(item, i) => (
              <Badge
                variant={UserMethods.can(me(), i()) ? "success" : "destructive"}
              >
                {t(`users.permissions.${item}`)}
              </Badge>
            )}
          </For>
        </div>
      </SettingsSection>

      <Show when={UserMethods.can(me(), UserPermissions.indexOf("ftp_read"))}>
        <PublicKeys isMine={true} userId={me().id} />
      </Show>

      <Sessions />
    </div>
  )
}

export default Profile
