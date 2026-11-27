import { createSignal, For, onMount, Show } from "solid-js"
import { DataState } from "~/components/ui/data-state"
import { useRouter, useT } from "~/hooks"
import type { DriverItem, PResp, Storage } from "~/types"
import { r } from "~/utils"
import { joinBase } from "~/utils/path"
import { SettingsSection } from "./form"

/**
 * The storage option that caps the download connections to one file (OP
 * drivers/115*\/meta.go `max_conns_per_file`). It stays each storage's own
 * setting; any driver that declares it is listed, by the item, not by name.
 */
const CONNS = "max_conns_per_file"

interface Row {
  id: number
  mount: string
  driver: string
  /** Set on the storage, or undefined for the driver's default. */
  value?: number
  fallback: string
}

const rowsOf = (
  storages: Storage[],
  drivers: Record<string, { additional: DriverItem[] }>,
): Row[] =>
  storages.flatMap((s) => {
    const item = drivers[s.driver]?.additional.find((i) => i.name === CONNS)
    if (!item) return []
    let set: unknown
    try {
      set = JSON.parse(s.addition || "{}")[CONNS]
    } catch {
      set = undefined
    }
    return [
      {
        id: s.id,
        mount: s.mount_path,
        driver: s.driver,
        value: typeof set === "number" && !Number.isNaN(set) ? set : undefined,
        fallback: item.default ?? "",
      },
    ]
  })

/**
 * Each storage's connections per file, read-only, each row leading to the
 * storage where it is changed (PLAN_FE_SYSTEM_UX_1127 §0.2 设置归位).
 */
export const ConnectionsPerFile = () => {
  const t = useT()
  const { to } = useRouter()
  const [rows, setRows] = createSignal<Row[]>([])
  const [loading, setLoading] = createSignal(true)
  const [error, setError] = createSignal<string>()

  const load = async () => {
    setLoading(true)
    setError(undefined)
    const [s, d] = await Promise.all([
      r.get("/admin/storage/list") as PResp<{ content: Storage[] | null }>,
      r.get("/admin/driver/list") as PResp<
        Record<string, { additional: DriverItem[] }>
      >,
    ])
    setLoading(false)
    if (s.code !== 200 || d.code !== 200) {
      setError(s.code !== 200 ? s.message : d.message)
      return
    }
    setRows(rowsOf(s.data.content ?? [], d.data ?? {}))
  }
  onMount(load)

  const shown = (row: Row) => {
    const v = row.value ?? Number(row.fallback)
    const text = v === 0 ? t("global.unlimited") : String(v)
    return row.value === undefined
      ? t("settings.layout.connections_default", { value: text })
      : text
  }

  return (
    <SettingsSection
      id="card-connections"
      card="connections"
      title={t("settings.layout.connections")}
      description={t("settings.layout.connections_scope")}
    >
      <DataState loading={loading()} error={error()} onRetry={load}>
        <Show
          when={rows().length > 0}
          fallback={
            <p class="py-3 text-sm text-muted-foreground">
              {t("settings.layout.connections_none")}
            </p>
          }
        >
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-xs text-muted-foreground">
                <th class="py-2 font-medium">
                  {t("settings.layout.connections_storage")}
                </th>
                <th class="py-2 text-right font-medium">
                  {t("settings.layout.connections_value")}
                </th>
              </tr>
            </thead>
            <tbody>
              <For each={rows()}>
                {(row) => {
                  // the storage form opens the item's fold and marks it
                  const href = `/@manage/storages/edit/${row.id}?focus=max_conns_per_file`
                  return (
                    <tr data-storage={row.id} class="border-t">
                      <td class="py-2 pr-3">
                        <a
                          href={joinBase(href)}
                          title={t("settings.layout.connections_edit")}
                          class="break-all font-medium text-foreground underline-offset-4 hover:underline"
                          onClick={(e) => {
                            if (e.button !== 0 || e.metaKey || e.ctrlKey) return
                            e.preventDefault()
                            to(href)
                          }}
                        >
                          {row.mount}
                        </a>
                        <span class="ml-2 text-xs text-muted-foreground">
                          {t(`drivers.drivers.${row.driver}`)}
                        </span>
                      </td>
                      <td
                        data-value
                        class="py-2 text-right tabular-nums text-muted-foreground"
                      >
                        {shown(row)}
                      </td>
                    </tr>
                  )
                }}
              </For>
            </tbody>
          </table>
        </Show>
      </DataState>
    </SettingsSection>
  )
}
