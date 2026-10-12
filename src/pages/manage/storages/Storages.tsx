import { TbFilter, TbPlus } from "solid-icons/tb"
import { createMemo, createSignal, For, Show } from "solid-js"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import {
  createDeleteConfirm,
  ResourceList,
  type RowAction,
} from "~/features/settings/form"
import { useFetch, useManageTitle, useRouter, useT } from "~/hooks"
import { EmptyResp, PageResp, PEmptyResp, Resp, Storage } from "~/types"
import {
  createPersistedSignal,
  handleResp,
  handleRespWithNotifySuccess,
  notify,
  r,
} from "~/utils"
import { StorageStatus, StorageUsage } from "./Storage"

const Storages = () => {
  const t = useT()
  useManageTitle("manage.sidemenu.storages")
  const { to } = useRouter()
  const [loading, fetchList] = useFetch(
    (): Promise<PageResp<Storage>> => r.get("/admin/storage/list"),
    true,
  )
  const [storages, setStorages] = createSignal<Storage[]>([])
  const [error, setError] = createSignal<string>()
  const refresh = async () => {
    handleResp(
      await fetchList(),
      (data) => {
        setError(undefined)
        setStorages(data.content)
      },
      (message) => setError(message),
    )
  }
  refresh()

  const [drivers, setDrivers] = createSignal<string[]>([])
  // Persisted so the driver filter survives leaving and returning to the page.
  const [selectedDrivers, setSelectedDrivers] = createPersistedSignal<string[]>(
    "storages-driver-filter",
    [],
  )
  ;(async () => {
    const resp: Resp<string[]> = await r.get("/admin/driver/names")
    handleResp(resp, setDrivers)
  })()

  const shown = createMemo(() =>
    selectedDrivers().length === 0
      ? storages()
      : storages().filter((s) => selectedDrivers().includes(s.driver)),
  )

  const loadAll = async () => {
    const resp: EmptyResp = await r.post("/admin/storage/load_all")
    handleResp(resp, () =>
      notify.success(t("storages.other.start_load_success")),
    )
  }

  const toggleDisabled = async (s: Storage) => {
    const resp: Awaited<PEmptyResp> = await r.post(
      `/admin/storage/${s.disabled ? "enable" : "disable"}?id=${s.id}`,
    )
    handleRespWithNotifySuccess(resp, refresh)
  }

  const removal = createDeleteConfirm<Storage>({
    name: (s) => s.mount_path,
    run: async (s) => {
      const resp: Awaited<PEmptyResp> = await r.post(
        `/admin/storage/delete?id=${s.id}`,
      )
      handleResp(resp, () => {
        notify.success(t("global.delete_success"))
        refresh()
      })
    },
  })

  const actions = (s: Storage): RowAction<Storage>[] => [
    {
      id: "toggle",
      label: t(`global.${s.disabled ? "enable" : "disable"}`),
      onSelect: toggleDisabled,
    },
    {
      id: "delete",
      label: t("global.delete"),
      destructive: true,
      onSelect: removal.ask,
    },
  ]

  return (
    <>
      <ResourceList
        rows={shown()}
        rowKey={(s) => s.id}
        loading={loading()}
        error={error()}
        onRefresh={refresh}
        toolbarActions={[
          {
            id: "add",
            label: t("global.add"),
            icon: <TbPlus class="mr-1.5 size-4" />,
            onSelect: () => to("/@manage/storages/add"),
          },
          {
            id: "load-all",
            label: t("storages.other.load_all"),
            variant: "outline",
            onSelect: loadAll,
          },
        ]}
        toolbar={
          <Show when={drivers().length > 0}>
            <DropdownMenu>
              <DropdownMenuTrigger as={Button} variant="outline">
                <TbFilter class="mr-1.5 size-4" />
                {t("storages.other.filter_by_driver")}
                <Show when={selectedDrivers().length > 0}>
                  <Badge variant="secondary" class="ml-1.5">
                    {selectedDrivers().length}
                  </Badge>
                </Show>
              </DropdownMenuTrigger>
              <DropdownMenuContent class="max-h-72 overflow-y-auto">
                <For each={drivers()}>
                  {(driver) => (
                    <DropdownMenuCheckboxItem
                      checked={selectedDrivers().includes(driver)}
                      onChange={(on) =>
                        setSelectedDrivers((cur) =>
                          on
                            ? [...cur, driver]
                            : cur.filter((d) => d !== driver),
                        )
                      }
                    >
                      {t(`drivers.drivers.${driver}`)}
                    </DropdownMenuCheckboxItem>
                  )}
                </For>
              </DropdownMenuContent>
            </DropdownMenu>
          </Show>
        }
        columns={[
          {
            id: "mount_path",
            header: t("storages.common.mount_path"),
            cell: (s) => (
              <span class="break-all font-medium">{s.mount_path}</span>
            ),
            sort: (s) => s.mount_path,
          },
          {
            id: "driver",
            header: t("storages.common.driver"),
            cell: (s) => t(`drivers.drivers.${s.driver}`),
            sort: (s) => s.driver,
          },
          {
            id: "order",
            header: t("storages.common.order"),
            cell: (s) => s.order,
            sort: (s) => s.order,
          },
          {
            id: "usage",
            header: t("storages.common.usage"),
            cell: (s) => <StorageUsage details={s.mount_details} />,
          },
          {
            id: "status",
            header: t("storages.common.status"),
            cell: (s) => <StorageStatus storage={s} />,
          },
          {
            id: "remark",
            header: t("storages.common.remark"),
            cell: (s) => <span class="break-all">{s.remark}</span>,
          },
        ]}
        card={{
          title: (s) => s.mount_path,
          badges: (s) => (
            <>
              <Badge variant="outline">
                {t(`drivers.drivers.${s.driver}`)}
              </Badge>
              <StorageStatus storage={s} />
            </>
          ),
          body: (s) => (
            <div class="flex flex-col gap-2">
              <StorageUsage details={s.mount_details} />
              <Show when={s.remark}>
                <span class="break-all">{s.remark}</span>
              </Show>
            </div>
          ),
        }}
        primary={(s) => ({
          id: "edit",
          label: t("global.edit"),
          onSelect: () => to(`/@manage/storages/edit/${s.id}`),
        })}
        actions={actions}
      />
      {removal.dialog()}
    </>
  )
}

export default Storages
