import { createSignal, Show } from "solid-js"
import { Button } from "~/components/ui/button"
import {
  DataState,
  FieldRenderer,
  SettingsSection,
} from "~/features/settings/form"
import { useFetch, useRouter, useT } from "~/hooks"
import { me, setMe } from "~/store"
import { PEmptyResp, PResp, Type } from "~/types"
import { handleResp, handleRespWithNotifySuccess, notify, r } from "~/utils"

interface Generate2FA {
  qr: string
  secret: string
}

const TwoFA = () => {
  const { back } = useRouter()
  const t = useT()
  const [generateLoading, generate] = useFetch((): PResp<Generate2FA> =>
    r.post("/auth/2fa/generate"),
  )
  const [otpData, setOtpData] = createSignal<Generate2FA>()
  const init = async () => {
    if (me().otp) {
      notify.warning(t("users.2fa_already_enabled"))
      back()
      return
    }
    handleResp(await generate(), setOtpData)
  }
  init()

  const [code, setCode] = createSignal("")
  const [verifyLoading, verify] = useFetch((): PEmptyResp =>
    r.post("/auth/2fa/verify", {
      code: code(),
      secret: otpData()?.secret,
    }),
  )
  const verify2FA = async () => {
    handleRespWithNotifySuccess(await verify(), () => {
      setMe({ ...me(), otp: true })
      back()
    })
  }

  return (
    <DataState loading={generateLoading()}>
      <Show when={otpData()}>
        <SettingsSection id="two-factor" title={t("users.scan_qr")}>
          <div class="flex flex-col items-start gap-3 py-4">
            <img
              src={otpData()?.qr}
              alt={t("users.scan_qr")}
              class="size-64 rounded-lg border bg-white p-2"
            />
            <p class="text-sm">
              {t("users.or_manual")}:{" "}
              <code class="break-all rounded bg-muted px-1.5 py-0.5 font-mono">
                {otpData()?.secret}
              </code>
            </p>
          </div>
          <form
            class="flex flex-col gap-2 py-3"
            onSubmit={(e) => {
              e.preventDefault()
              verify2FA()
            }}
          >
            <FieldRenderer
              stacked
              field={{
                id: "code",
                type: Type.String,
                labelKey: "users.input_code",
              }}
              value={code()}
              onChange={(raw) => setCode(String(raw))}
            />
            <Button type="submit" class="self-start" disabled={verifyLoading()}>
              {t("users.verify")}
            </Button>
          </form>
        </SettingsSection>
      </Show>
    </DataState>
  )
}

export default TwoFA
