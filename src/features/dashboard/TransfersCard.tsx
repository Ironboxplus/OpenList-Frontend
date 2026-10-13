import { TbArrowsUpDown } from "solid-icons/tb"
import { createMemo, onCleanup } from "solid-js"
import { DataState } from "~/components/ui/data-state"
import { useRouter, useT } from "~/hooks"
import { transfers } from "../transfers/service"
import { DashboardCard } from "./DashboardCard"
import { summarizeTransfers } from "./summary"

const Stat = (props: { label: string; value: number; tone?: string }) => (
  <div class="flex flex-col">
    <span class={`text-2xl font-semibold tabular-nums ${props.tone ?? ""}`}>
      {props.value}
    </span>
    <span class="text-xs text-muted-foreground">{props.label}</span>
  </div>
)

/** The counts come from the one transfers store; the store has no error state of its own. */
export const TransfersCard = () => {
  const t = useT()
  const { to } = useRouter()
  const release = transfers.watch()
  onCleanup(release)
  const summary = createMemo(() => summarizeTransfers(transfers.tasks()))
  return (
    <DashboardCard
      testid="dashboard-transfers"
      title={t("dashboard.transfers.title")}
      icon={TbArrowsUpDown}
      onOpen={() => to("/@transfers")}
    >
      <DataState
        loading={!transfers.loaded()}
        empty={transfers.loaded() ? transfers.tasks().length === 0 : undefined}
        emptyText={t("dashboard.transfers.empty")}
      >
        <div class="grid grid-cols-3 gap-2">
          <Stat
            label={t("dashboard.transfers.active")}
            value={summary().active}
          />
          <Stat
            label={t("dashboard.transfers.failed")}
            value={summary().failed}
            tone={summary().failed > 0 ? "text-destructive" : ""}
          />
          <Stat
            label={t("dashboard.transfers.stale")}
            value={summary().stale}
          />
        </div>
      </DataState>
    </DashboardCard>
  )
}
