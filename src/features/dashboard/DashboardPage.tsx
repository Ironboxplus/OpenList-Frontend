// A read-only overview: counts and shortcuts, never a configuration form
// (REFACTOR_PLAN §7.1). Admin-only diagnostics arrive through plugin slots.
import { For } from "solid-js"
import { useT, useTitle } from "~/hooks"
import { PluginSlot } from "~/plugins"
import { me } from "~/store"
import { UserMethods } from "~/types"
import { ErrorsCard } from "./ErrorsCard"
import { FavoritesCard } from "./FavoritesCard"
import { dashboardSlots } from "./summary"
import { TransfersCard } from "./TransfersCard"

const DashboardPage = () => {
  const t = useT()
  useTitle(() => t("dashboard.title"))
  return (
    <div class="mx-auto flex w-full max-w-[1600px] flex-col gap-6 p-4 sm:p-6">
      <h1 class="text-xl font-semibold">{t("dashboard.title")}</h1>
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <TransfersCard />
        <ErrorsCard />
        <FavoritesCard />
      </div>
      <For each={dashboardSlots(UserMethods.is_admin(me()))}>
        {(name) => <PluginSlot name={name} />}
      </For>
    </div>
  )
}

export default DashboardPage
