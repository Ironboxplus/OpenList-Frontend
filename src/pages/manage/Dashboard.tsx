import { Show } from "solid-js"
import { useManageTitle, useT } from "~/hooks"
import { PluginSlot, slotComponents } from "~/plugins"

const Dashboard = () => {
  const t = useT()
  useManageTitle("manage.sidemenu.dashboard")
  return (
    <div class="flex w-full flex-col gap-4">
      <Show when={slotComponents("manage-dashboard").length === 0}>
        <p class="text-sm text-muted-foreground">{t("manage.plugins_empty")}</p>
      </Show>
      <PluginSlot name="manage-dashboard" />
    </div>
  )
}

export default Dashboard
