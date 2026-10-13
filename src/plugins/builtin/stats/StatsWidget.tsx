import { TbDatabase } from "solid-icons/tb"
import { createMemo, createResource, For, Show } from "solid-js"
import { DashboardCard } from "~/features/dashboard/DashboardCard"
import { DataState } from "~/components/ui/data-state"
import { focusRing } from "~/components/ui/focus"
import { Progress } from "~/components/ui/progress"
import { useRouter, useT } from "~/hooks"
import { apiGet } from "~/platform/api/client"
import { me } from "~/store"
import { UserMethods, type Storage } from "~/types"
import { cn } from "~/utils/cn"
import { storageUsageRows, type UsageRow } from "./data"

const load = async (): Promise<Storage[]> => {
  const r = await apiGet<{ content: Storage[] | null }>("/admin/storage/list", {
    params: { page: 1, per_page: 1000 },
  })
  if (!r.ok) throw new Error(r.error.message)
  return r.data.content ?? []
}

/**
 * Storage usage as a list: mount path, a bar, "used / total". Biggest first,
 * storages without a known size last, broken ones in red (they open the
 * storages page).
 */
const Row = (props: { row: UsageRow }) => {
  const t = useT()
  const { to } = useRouter()
  const row = () => props.row
  const body = (
    <>
      <span class="truncate font-medium">{row().path}</span>
      <Show
        when={!row().unknown}
        fallback={<span class="hidden h-2 rounded-full bg-muted sm:block" />}
      >
        <Progress
          value={row().percent}
          minValue={0}
          maxValue={100}
          aria-label={row().path}
          fillClass={
            row().failing
              ? "bg-destructive"
              : row().percent >= 90
                ? "bg-warning"
                : undefined
          }
        />
      </Show>
      <span class="truncate text-xs tabular-nums sm:text-right">
        {row().unknown ? t("dashboard.storage.unknown") : row().text}
        <Show when={row().failing}>
          {" · "}
          {t("dashboard.storage.failing")}
        </Show>
      </span>
    </>
  )
  const cls = cn(
    "grid w-full grid-cols-[minmax(0,1fr)] items-center gap-x-4 gap-y-1 rounded-md px-2 py-1.5 text-left text-sm sm:grid-cols-[minmax(8rem,14rem)_minmax(0,1fr)_minmax(7rem,auto)]",
    row().failing
      ? "text-destructive"
      : "[&>span:last-child]:text-muted-foreground",
  )
  return (
    <li>
      <Show
        when={row().failing}
        fallback={
          <div data-testid="stats-storage-row" class={cls}>
            {body}
          </div>
        }
      >
        <button
          type="button"
          data-testid="stats-storage-row"
          data-failing=""
          title={row().status}
          onClick={() => to("/@manage/storages")}
          class={cn(focusRing, cls, "bg-transparent hover:bg-accent")}
        >
          {body}
        </button>
      </Show>
    </li>
  )
}

const StatsList = () => {
  const t = useT()
  const [storages, { refetch }] = createResource(load)
  const rows = createMemo(() => storageUsageRows(storages() ?? []))
  const message = () => {
    const e = storages.error
    return e ? (e instanceof Error ? e.message : String(e)) : undefined
  }
  return (
    <DashboardCard
      testid="stats-storage-usage"
      title={t("dashboard.storage.title")}
      icon={TbDatabase}
    >
      <DataState
        loading={storages.loading}
        error={message()}
        onRetry={() => void refetch()}
        empty={!storages.loading && !storages.error && rows().length === 0}
        emptyText={t("dashboard.storage.empty")}
        skeletonRows={3}
      >
        <ul class="m-0 flex list-none flex-col gap-1 p-0">
          <For each={rows()}>{(row) => <Row row={row} />}</For>
        </ul>
      </DataState>
    </DashboardCard>
  )
}

/** The list reads /admin/storage/list, so anyone else gets nothing (and no request). */
const StatsWidget = () => (
  <Show when={UserMethods.is_admin(me())}>
    <StatsList />
  </Show>
)

export default StatsWidget
