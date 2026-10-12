import { TbPlus } from "solid-icons/tb"
import { createSignal } from "solid-js"
import { createDeleteConfirm, ResourceList } from "~/features/settings/form"
import { useFetch, useT } from "~/hooks"
import { PEmptyResp, PResp } from "~/types"
import { handleResp, handleRespWithoutNotify, notify, r } from "~/utils"

export interface WebauthnCredential {
  fingerprint: string
  id: string
}

interface WebauthnBegin {
  session: string
  options: { publicKey: PublicKeyCredentialCreationOptionsJSON }
}

export const webauthnSupported = () =>
  !!globalThis.PublicKeyCredential?.parseCreationOptionsFromJSON

/** The signed-in user's passkeys: list, register a new one, delete (confirmed). */
export const WebauthnCredentials = () => {
  const t = useT()
  const [credentials, setCredentials] = createSignal<WebauthnCredential[]>([])
  const [loading, fetchCredentials] = useFetch(
    (): PResp<WebauthnCredential[]> => r.get("/authn/getcredentials"),
    true,
  )
  const refresh = async () => {
    handleRespWithoutNotify(await fetchCredentials(), (data) =>
      setCredentials(data ?? []),
    )
  }
  refresh()

  const [, begin] = useFetch((): PResp<WebauthnBegin> =>
    r.get("/authn/webauthn_begin_registration"),
  )
  const [registering, finish] = useFetch(
    (session: string, credential: PublicKeyCredential): PEmptyResp =>
      r.post(
        "/authn/webauthn_finish_registration",
        JSON.stringify(credential.toJSON()),
        { headers: { session } },
      ),
  )
  const register = async () => {
    if (!webauthnSupported()) {
      notify.error(t("users.webauthn_not_supported"))
      return
    }
    handleResp(await begin(), async (data) => {
      try {
        const created = (await navigator.credentials.create({
          publicKey: PublicKeyCredential.parseCreationOptionsFromJSON(
            data.options.publicKey,
          ),
        })) as PublicKeyCredential
        handleResp(await finish(data.session, created), () => {
          notify.success(t("users.add_webauthn_success"))
          refresh()
        })
      } catch (error: unknown) {
        if (error instanceof Error) notify.error(error.message)
      }
    })
  }

  const removal = createDeleteConfirm<WebauthnCredential>({
    name: (c) => c.fingerprint,
    run: async (c) => {
      const resp: Awaited<PEmptyResp> = await r.post("/authn/delete_authn", {
        id: c.id,
      })
      handleResp(resp, () => {
        notify.success(t("global.delete_success"))
        refresh()
      })
    },
  })

  return (
    <>
      <ResourceList
        rows={credentials()}
        rowKey={(c) => c.id}
        loading={loading() || registering()}
        toolbarActions={[
          {
            id: "add-webauthn",
            label: t("users.add_webauthn"),
            icon: <TbPlus class="mr-1.5 size-4" />,
            onSelect: register,
          },
        ]}
        columns={[
          {
            id: "fingerprint",
            header: t("users.ssh_keys.fingerprint"),
            cell: (c) => (
              <span class="break-all font-mono text-xs">{c.fingerprint}</span>
            ),
          },
          {
            id: "id",
            header: "ID",
            cell: (c) => <span class="break-all text-xs">{c.id}</span>,
          },
        ]}
        card={{
          title: (c) => c.fingerprint,
          body: (c) => <span class="break-all text-xs">{c.id}</span>,
        }}
        actions={() => [
          {
            id: "delete",
            label: t("global.delete"),
            destructive: true,
            onSelect: removal.ask,
          },
        ]}
      />
      {removal.dialog()}
    </>
  )
}
