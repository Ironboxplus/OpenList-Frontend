import { TbPlus } from "solid-icons/tb"
import { createSignal } from "solid-js"
import { Wether } from "~/components"
import { createDeleteConfirm, ResourceList } from "~/features/settings/form"
import { useFetch, useManageTitle, useRouter, useT } from "~/hooks"
import { Meta, PEmptyResp, PPageResp } from "~/types"
import { handleResp, notify, r } from "~/utils"

const Metas = () => {
  const t = useT()
  useManageTitle("manage.sidemenu.metas")
  const { to } = useRouter()
  const [loading, fetchList] = useFetch(
    (): PPageResp<Meta> => r.get("/admin/meta/list"),
    true,
  )
  const [metas, setMetas] = createSignal<Meta[]>([])
  const [error, setError] = createSignal<string>()
  const refresh = async () => {
    handleResp(
      await fetchList(),
      (data) => {
        setError(undefined)
        setMetas(data.content)
      },
      setError,
    )
  }
  refresh()

  const removal = createDeleteConfirm<Meta>({
    name: (m) => m.path,
    run: async (m) => {
      const resp: Awaited<PEmptyResp> = await r.post(
        `/admin/meta/delete?id=${m.id}`,
      )
      handleResp(resp, () => {
        notify.success(t("global.delete_success"))
        refresh()
      })
    },
  })

  return (
    <>
      <ResourceList
        rows={metas()}
        rowKey={(m) => m.id}
        loading={loading()}
        error={error()}
        onRefresh={refresh}
        toolbarActions={[
          {
            id: "add",
            label: t("global.add"),
            icon: <TbPlus class="mr-1.5 size-4" />,
            onSelect: () => to("/@manage/metas/add"),
          },
        ]}
        columns={[
          {
            id: "path",
            header: t("metas.path"),
            cell: (m) => <span class="break-all font-medium">{m.path}</span>,
            sort: (m) => m.path,
          },
          {
            id: "password",
            header: t("metas.password"),
            cell: (m) => <span class="break-all">{m.password}</span>,
          },
          {
            id: "write",
            header: t("metas.write"),
            cell: (m) => <Wether yes={m.write} />,
          },
        ]}
        card={{
          title: (m) => <span class="break-all">{m.path}</span>,
          badges: (m) => (m.write ? <Wether yes={m.write} /> : null),
          body: (m) => (
            <span class="break-all">
              {t("metas.password")}: {m.password}
            </span>
          ),
        }}
        primary={(m) => ({
          id: "edit",
          label: t("global.edit"),
          onSelect: () => to(`/@manage/metas/edit/${m.id}`),
        })}
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

export default Metas
