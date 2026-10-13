import { TbArrowsUpDown } from "solid-icons/tb"
import { createMemo, For, Show, onCleanup } from "solid-js"
import { DataState } from "~/components/ui/data-state"
import { useRouter, useT } from "~/hooks"
import { transfers } from "../transfers/service"
import { DashboardCard } from "./DashboardCard"
import { transferDay } from "./stats-model"

const Stat = (props: { label: string; value: number; tone?: string }) => (
  <div class="flex flex-col">
    <span class={`text-2xl font-semibold tabular-nums ${props.tone ?? ""}`}>
      {props.value}
    </span>
    <span class="text-xs text-muted-foreground">{props.label}</span>
  </div>
)

/**
 * In progress now, and what finished or failed today (by end time). All of it
 * is computed here from the one transfers store's tasks; there is no endpoint.
 */
export const TransfersCard = (props: { class?: string }) => {
  const t = useT()
  const { to } = useRouter()
  const release = transfers.watch()
  onCleanup(release)
  const day = createMemo(() => transferDay(transfers.tasks(), new Date()))
  return (
    <DashboardCard
      testid="dashboard-transfers"
      title={t("dashboard.transfers.title")}
      icon={TbArrowsUpDown}
      onOpen={() => to("/@transfers")}
      class={props.class}
    >
      <DataState
        loading={!transfers.loaded()}
        empty={transfers.loaded() ? transfers.tasks().length === 0 : undefined}
        emptyText={t("dashboard.transfers.empty")}
      >
        <div class="grid grid-cols-3 gap-2">
          <Stat label={t("dashboard.transfers.active")} value={day().active} />
          <Stat
            label={t("dashboard.transfers.done_today")}
            value={day().doneToday}
          />
          <Stat
            label={t("dashboard.transfers.failed_today")}
            value={day().failedToday}
            tone={day().failedToday > 0 ? "text-destructive" : ""}
          />
        </div>
        <Show when={day().byType.length > 0}>
          <ul class="m-0 flex list-none flex-wrap gap-x-3 gap-y-1 p-0 text-xs text-muted-foreground">
            <For each={day().byType}>
              {(row) => (
                <li data-testid="dashboard-transfer-type" class="tabular-nums">
                  {t(`transfers.type.${row.type}`)} {row.done}
                  <Show when={row.failed > 0}>
                    <span class="text-destructive"> / {row.failed}</span>
                  </Show>
                </li>
              )}
            </For>
          </ul>
        </Show>
      </DataState>
    </DashboardCard>
  )
}
