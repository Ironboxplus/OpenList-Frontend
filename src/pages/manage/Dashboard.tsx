import { Heading, VStack } from "@hope-ui/solid"
import { Show } from "solid-js"
import { useManageTitle, useT } from "~/hooks"
import { PluginSlot, slotComponents } from "~/plugins"

const Dashboard = () => {
  const t = useT()
  useManageTitle("manage.sidemenu.dashboard")
  return (
    <VStack w="$full" alignItems="stretch" spacing="$4" p="$2">
      <Heading size="xl">{t("manage.sidemenu.dashboard")}</Heading>
      <Show when={slotComponents("manage-dashboard").length === 0}>
        <Heading size="sm" color="$neutral9">
          {t("manage.plugins_empty")}
        </Heading>
      </Show>
      <PluginSlot name="manage-dashboard" />
    </VStack>
  )
}

export default Dashboard
