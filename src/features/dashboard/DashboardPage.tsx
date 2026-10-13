// A read-only overview: counts, charts and shortcuts, never a configuration
// form (REFACTOR_PLAN §7.1). The relayed-traffic, library and sync figures are
// site-wide and admin-only; everyone else gets transfers, errors and favorites.
// The title is not repeated here: the navigation already says "Home".
import { createEffect, createMemo, For, on, onMount } from "solid-js"
import { useT, useTitle } from "~/hooks"
import { PluginSlot } from "~/plugins"
import { me } from "~/store"
import { UserMethods } from "~/types"
import { transfers } from "../transfers/service"
import { ErrorsCard } from "./ErrorsCard"
import { FavoritesCard } from "./FavoritesCard"
import {
  DailyTrafficCard,
  MediaStatsCard,
  SpeedCard,
  SyncCard,
  TrafficOverviewCard,
} from "./StatsCards"
import { createStatsOverview } from "./stats-store"
import { dashboardSlots } from "./summary"
import { TransfersCard } from "./TransfersCard"

/**
 * Desktop is a 12-column grid, tablet two columns, phone one. The DOM order is
 * the desktop reading order; on phones `order-*` puts the traffic and the live
 * speed first, then transfers and the library, and the rest after.
 */
const AdminCards = () => {
  const stats = createStatsOverview()
  // The sync runs come from the transfer store's history; load it when the page
  // opens and again whenever a job starts or ends.
  const running = createMemo(
    () =>
      transfers.tasks().filter((t) => t.type.startsWith("sync.") && !t.endedAt)
        .length,
  )
  onMount(() => void transfers.loadHistory())
  createEffect(on(running, () => void transfers.loadHistory(), { defer: true }))
  return (
    <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-12">
      <TrafficOverviewCard
        stats={stats}
        class="order-1 md:order-none xl:col-span-6"
      />
      <SpeedCard stats={stats} class="order-2 md:order-none xl:col-span-6" />
      <DailyTrafficCard
        stats={stats}
        class="order-5 md:order-none md:col-span-2 xl:col-span-8"
      />
      <MediaStatsCard
        stats={stats}
        class="order-4 md:order-none xl:col-span-4"
      />
      <TransfersCard class="order-3 md:order-none xl:col-span-4" />
      <SyncCard class="order-6 md:order-none xl:col-span-4" />
      <FavoritesCard
        top={5}
        withErrors
        class="order-7 md:order-none xl:col-span-4"
      />
    </div>
  )
}

const DashboardPage = () => {
  const t = useT()
  useTitle(() => t("dashboard.title"))
  const admin = () => UserMethods.is_admin(me())
  return (
    <div class="mx-auto flex w-full max-w-[1600px] flex-col gap-4 p-4 sm:p-6">
      {admin() ? (
        <AdminCards />
      ) : (
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <TransfersCard />
          <ErrorsCard />
          <FavoritesCard />
        </div>
      )}
      <For each={dashboardSlots(admin())}>
        {(name) => <PluginSlot name={name} />}
      </For>
    </div>
  )
}

export default DashboardPage
