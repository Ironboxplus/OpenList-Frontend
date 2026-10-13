import {
  TbActivity,
  TbArrowDown,
  TbArrowUp,
  TbChartBar,
  TbMovie,
  TbRefresh,
} from "solid-icons/tb"
import { createMemo, For, lazy, Show, Suspense, type JSX } from "solid-js"
import { DataState } from "~/components/ui/data-state"
import { Skeleton } from "~/components/ui/skeleton"
import { useRouter, useT } from "~/hooks"
import { cn } from "~/utils/cn"
import { bytesText } from "./stats-model"
import {
  durationText,
  mediaRows,
  recentSyncRuns,
  speedNow,
  trafficRows,
  type SyncRun,
} from "./stats-model"
import { DashboardCard } from "./DashboardCard"
import { DOWNLOAD_COLOR, UPLOAD_COLOR } from "./stats-charts"
import type { StatsOverviewStore } from "./stats-store"
import { transfers } from "../transfers/service"

const TrafficChart = lazy(() => import("./TrafficChart"))

/**
 * Loading keeps the card's size (placeholder rows); a failed first load shows
 * the message with a retry. Once data has arrived it stays on screen, and a
 * later failed round only adds a note that the numbers are not fresh.
 */
const Fetched = (props: {
  stats: StatsOverviewStore
  children: JSX.Element
  /** Placeholder rows while the first answer is awaited. */
  rows?: number
}) => {
  const t = useT()
  return (
    <Show
      when={props.stats.loaded()}
      fallback={
        <DataState
          loading
          error={props.stats.error()}
          onRetry={() => void props.stats.retry()}
          skeletonRows={props.rows ?? 2}
        >
          {null}
        </DataState>
      }
    >
      {props.children}
      <Show when={props.stats.error()}>
        <p class="m-0 text-xs text-destructive" role="status">
          {t("dashboard.stale")}
        </p>
      </Show>
    </Show>
  )
}

const Rate = (props: { value: string; kind: "down" | "up"; big?: boolean }) => (
  <span class="flex min-w-0 items-baseline gap-1 tabular-nums">
    {props.kind === "down" ? (
      <TbArrowDown
        class="size-4 shrink-0 self-center"
        style={{ color: DOWNLOAD_COLOR }}
      />
    ) : (
      <TbArrowUp
        class="size-4 shrink-0 self-center"
        style={{ color: UPLOAD_COLOR }}
      />
    )}
    <span
      class={cn(
        "font-mono font-semibold",
        props.big ? "text-xl xl:text-2xl" : "text-lg",
      )}
    >
      {props.value}
    </span>
  </span>
)

export const TrafficOverviewCard = (props: {
  stats: StatsOverviewStore
  class?: string
}) => {
  const t = useT()
  const rows = createMemo(() => trafficRows(props.stats.data()))
  return (
    <DashboardCard
      testid="dashboard-traffic"
      title={t("dashboard.traffic.title")}
      icon={TbChartBar}
      class={props.class}
    >
      <Fetched stats={props.stats}>
        <div class="grid grid-cols-3 gap-3">
          <For each={rows()}>
            {(row) => (
              <div class="flex min-w-0 flex-col gap-1" data-period={row.period}>
                <span class="text-xs text-muted-foreground">
                  {t(`dashboard.traffic.${row.period}`)}
                </span>
                <Rate kind="down" value={row.server.down} big />
                <Rate kind="up" value={row.server.up} big />
                <span class="mt-1 text-xs text-muted-foreground tabular-nums">
                  {t("dashboard.traffic.client")} ↓ {row.client.down} · ↑{" "}
                  {row.client.up}
                </span>
              </div>
            )}
          </For>
        </div>
        <p class="m-0 text-xs text-muted-foreground">
          {t("dashboard.traffic.note", {
            node: props.stats.data()?.node || t("dashboard.traffic.this_node"),
          })}
        </p>
      </Fetched>
    </DashboardCard>
  )
}

export const SpeedCard = (props: {
  stats: StatsOverviewStore
  class?: string
}) => {
  const t = useT()
  const speed = createMemo(() => speedNow(props.stats.data()))
  return (
    <DashboardCard
      testid="dashboard-speed"
      title={t("dashboard.speed.title")}
      icon={TbActivity}
      class={props.class}
    >
      <Fetched stats={props.stats} rows={4}>
        <div class="flex flex-wrap gap-x-6 gap-y-1">
          <Rate kind="down" value={speed().down} big />
          <Rate kind="up" value={speed().up} big />
        </div>
        <Suspense fallback={<Skeleton class="h-40 w-full" />}>
          <TrafficChart
            kind="speed"
            data={props.stats.data()!.traffic}
            height="10rem"
          />
        </Suspense>
      </Fetched>
    </DashboardCard>
  )
}

export const DailyTrafficCard = (props: {
  stats: StatsOverviewStore
  class?: string
}) => {
  const t = useT()
  return (
    <DashboardCard
      testid="dashboard-daily"
      title={t("dashboard.daily.title")}
      icon={TbChartBar}
      class={props.class}
    >
      <Fetched stats={props.stats} rows={5}>
        <Suspense fallback={<Skeleton class="h-56 w-full" />}>
          <TrafficChart
            kind="daily"
            data={props.stats.data()!.traffic}
            height="14rem"
          />
        </Suspense>
      </Fetched>
    </DashboardCard>
  )
}

export const MediaStatsCard = (props: {
  stats: StatsOverviewStore
  class?: string
}) => {
  const t = useT()
  const { to } = useRouter()
  const rows = createMemo(() => mediaRows(props.stats.data()?.media))
  return (
    <DashboardCard
      testid="dashboard-media"
      title={t("dashboard.media.title")}
      icon={TbMovie}
      onOpen={() => to("/@media")}
      class={props.class}
    >
      <Fetched stats={props.stats}>
        <div class="grid grid-cols-3 gap-3">
          <For each={rows()}>
            {(row) => (
              <div class="flex flex-col" data-media={row.key}>
                <span
                  class={cn(
                    "text-2xl font-semibold tabular-nums",
                    row.attention && "text-warning",
                  )}
                >
                  {row.value}
                </span>
                <span class="text-xs text-muted-foreground">
                  {t(`dashboard.media.${row.key}`)}
                </span>
              </div>
            )}
          </For>
        </div>
      </Fetched>
    </DashboardCard>
  )
}

const stateTone = (s: SyncRun["state"]) =>
  s === "failed"
    ? "text-destructive"
    : s === "succeeded"
      ? "text-success"
      : "text-muted-foreground"

export const SyncCard = (props: { class?: string }) => {
  const t = useT()
  const { to } = useRouter()
  const runs = createMemo(() =>
    recentSyncRuns(transfers.tasks(), transfers.history()),
  )
  return (
    <DashboardCard
      testid="dashboard-sync"
      title={t("dashboard.sync.title")}
      icon={TbRefresh}
      onOpen={() => to("/@transfers?type=sync")}
      class={props.class}
    >
      <DataState
        loading={!transfers.loaded()}
        empty={transfers.loaded() ? runs().length === 0 : undefined}
        emptyText={t("dashboard.sync.empty")}
      >
        <ul class="m-0 flex list-none flex-col gap-2 p-0">
          <For each={runs()}>
            {(run) => (
              <li
                class="flex flex-col text-sm"
                data-testid="dashboard-sync-run"
              >
                <span class="flex items-baseline gap-2 tabular-nums">
                  <span class={cn("font-medium", stateTone(run.state))}>
                    {t(`transfers.state.${run.state}`)}
                  </span>
                  <span class="text-xs text-muted-foreground">
                    {durationText(run.durationMs)} · {bytesText(run.bytes)}
                  </span>
                </span>
                <span class="truncate text-xs text-muted-foreground">
                  {run.route}
                </span>
              </li>
            )}
          </For>
        </ul>
      </DataState>
    </DashboardCard>
  )
}
