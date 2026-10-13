import { TbBell } from "solid-icons/tb"
import { For } from "solid-js"
import { DataState } from "~/components/ui/data-state"
import { useT } from "~/hooks"
import { errorCenter } from "../notifications/service"
import { setErrorCenterOpen } from "../notifications/state"
import { DashboardCard } from "./DashboardCard"
import { recentErrors } from "./summary"

/** Opens the error center through the same state the top bar's bell uses. */
export const ErrorsCard = (props: { class?: string }) => {
  const t = useT()
  const shown = () => recentErrors(errorCenter.records())
  return (
    <DashboardCard
      testid="dashboard-errors"
      title={t("dashboard.errors.title")}
      icon={TbBell}
      onOpen={() => setErrorCenterOpen(true)}
      class={props.class}
    >
      <p class="m-0 text-xs text-muted-foreground">
        {t("dashboard.errors.unread", { count: errorCenter.unreadCount() })}
      </p>
      <DataState
        empty={shown().length === 0}
        emptyText={t("dashboard.errors.empty")}
      >
        <ul class="m-0 flex list-none flex-col gap-2 p-0">
          <For each={shown()}>
            {(rec) => (
              <li class="flex flex-col text-sm" data-testid="dashboard-error">
                <span class="truncate">{rec.message}</span>
                <span class="truncate text-xs text-muted-foreground">
                  {rec.source} · {new Date(rec.at).toLocaleString()}
                </span>
              </li>
            )}
          </For>
        </ul>
      </DataState>
    </DashboardCard>
  )
}
