import { TbPlus } from "solid-icons/tb"
import { createSignal } from "solid-js"
import { createStore } from "solid-js/store"
import { Button } from "~/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog"
import {
  createDeleteConfirm,
  FieldRenderer,
  ResourceList,
} from "~/features/settings/form"
import { useFetch, useT } from "~/hooks"
import { PEmptyResp, PPageResp, Type } from "~/types"
import { SSHPublicKey } from "~/types/sshkey"
import { handleResp, notify, r } from "~/utils"

export interface PublicKeysProps {
  /** The signed-in user's own keys (they may add); otherwise an admin viewing `userId`. */
  isMine: boolean
  userId: number
}

export interface SSHKeyAddReq {
  title: string
  key: string
}

const formatDate = (date: Date) => {
  const pad = (n: number) => n.toString().padStart(2, "0")
  return (
    `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  )
}

export const PublicKeys = (props: PublicKeysProps) => {
  const t = useT()
  const [keys, setKeys] = createSignal<SSHPublicKey[]>([])
  const [error, setError] = createSignal<string>()
  const [loading, fetchKeys] = useFetch(
    (): PPageResp<SSHPublicKey> =>
      props.isMine
        ? r.get("/me/sshkey/list")
        : r.get(`/admin/user/sshkey/list?uid=${props.userId}`),
    true,
  )
  const refresh = async () => {
    handleResp(
      await fetchKeys(),
      (data) => {
        setError(undefined)
        setKeys(data.content)
      },
      setError,
    )
  }
  refresh()

  const [addOpen, setAddOpen] = createSignal(false)
  const [addReq, setAddReq] = createStore<SSHKeyAddReq>({ title: "", key: "" })
  const [adding, add] = useFetch((): PEmptyResp =>
    r.post("/me/sshkey/add", addReq),
  )

  const removal = createDeleteConfirm<SSHPublicKey>({
    name: (k) => k.title,
    run: async (k) => {
      const resp: Awaited<PEmptyResp> = await r.post(
        props.isMine
          ? `/me/sshkey/delete?id=${k.id}`
          : `/admin/user/sshkey/delete?uid=${props.userId}&id=${k.id}`,
      )
      handleResp(resp, () => {
        notify.success(t("global.delete_success"))
        refresh()
      })
    },
  })

  return (
    <section class="flex flex-col gap-2" data-section="ssh-keys">
      <h2 class="text-base font-semibold">{t("users.ssh_keys.heading")}</h2>
      <ResourceList
        rows={keys()}
        rowKey={(k) => k.id}
        loading={loading()}
        error={error()}
        onRefresh={refresh}
        toolbarActions={
          props.isMine
            ? [
                {
                  id: "add-key",
                  label: t("global.add"),
                  icon: <TbPlus class="mr-1.5 size-4" />,
                  onSelect: () => setAddOpen(true),
                },
              ]
            : []
        }
        columns={[
          {
            id: "title",
            header: t("users.ssh_keys.title"),
            cell: (k) => <span class="font-medium">{k.title}</span>,
            sort: (k) => k.title,
          },
          {
            id: "fingerprint",
            header: t("users.ssh_keys.fingerprint"),
            cell: (k) => (
              <span class="break-all font-mono text-xs">{k.fingerprint}</span>
            ),
          },
          {
            id: "last_used",
            header: t("users.ssh_keys.last_used"),
            cell: (k) => formatDate(new Date(k.last_used_time)),
            sort: (k) => k.last_used_time,
          },
        ]}
        card={{
          title: (k) => k.title,
          body: (k) => (
            <div class="flex flex-col gap-1">
              <span class="break-all font-mono text-xs">{k.fingerprint}</span>
              <span>{formatDate(new Date(k.last_used_time))}</span>
            </div>
          ),
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
      <Dialog open={addOpen()} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("users.ssh_keys.add_heading")}</DialogTitle>
            <DialogDescription class="sr-only">
              {t("users.ssh_keys.add_heading")}
            </DialogDescription>
          </DialogHeader>
          <FieldRenderer
            stacked
            field={{
              id: "add_title",
              type: Type.String,
              labelKey: "users.ssh_keys.title",
            }}
            value={addReq.title}
            onChange={(raw) => setAddReq("title", String(raw))}
          />
          <FieldRenderer
            stacked
            field={{
              id: "add_key",
              type: Type.Text,
              labelKey: "users.ssh_keys.key",
            }}
            value={addReq.key}
            onChange={(raw) => setAddReq("key", String(raw))}
          />
          <DialogFooter>
            <Button
              type="button"
              disabled={adding()}
              onClick={async () => {
                handleResp(await add(), () => {
                  setAddReq({ title: "", key: "" })
                  refresh()
                  setAddOpen(false)
                })
              }}
            >
              {t("global.add")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
