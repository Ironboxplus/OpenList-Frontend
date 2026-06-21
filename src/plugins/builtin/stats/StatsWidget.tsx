import { Box, Grid, Heading, VStack } from "@hope-ui/solid"
import { createMemo, createSignal, onMount } from "solid-js"
import { EChart } from "~/components/EChart"
import { useFetch, useT } from "~/hooks"
import { handleResp, r, toReadableUsage } from "~/utils"
import type { PageResp, Storage } from "~/types"
import { driverDistribution, storageUsageSeries } from "./data"

const StatsWidget = () => {
  const t = useT()
  const [storages, setStorages] = createSignal<Storage[]>([])
  const [, getStorages] = useFetch(
    (): Promise<PageResp<Storage>> => r.get("/admin/storage/list"),
  )
  onMount(async () => {
    handleResp(await getStorages(), (data) => setStorages(data.content))
  })

  const driverOption = createMemo(() => ({
    tooltip: { trigger: "item" },
    legend: { bottom: 0, type: "scroll" },
    series: [
      {
        name: t("manage.sidemenu.storages"),
        type: "pie",
        radius: ["40%", "70%"],
        avoidLabelOverlap: true,
        itemStyle: {
          borderRadius: 6,
          borderColor: "transparent",
          borderWidth: 2,
        },
        data: driverDistribution(storages()),
      },
    ],
  }))

  const usageOption = createMemo(() => {
    const series = storageUsageSeries(storages())
    return {
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: (params: any[]) => {
          const d = series[params[0].dataIndex]
          return `${d.name}<br/>${toReadableUsage({
            total_space: d.total,
            used_space: d.used,
            driver_name: "",
          })} (${d.percent.toFixed(1)}%)`
        },
      },
      legend: { bottom: 0 },
      grid: { left: "3%", right: "4%", bottom: "12%", containLabel: true },
      xAxis: {
        type: "category",
        data: series.map((s) => s.name),
        axisLabel: { rotate: 30 },
      },
      yAxis: { type: "value" },
      series: [
        {
          name: t("storages.common.usage"),
          type: "bar",
          stack: "cap",
          data: series.map((s) => s.used),
        },
        {
          name: t("manage.stats_free"),
          type: "bar",
          stack: "cap",
          data: series.map((s) => s.free),
        },
      ],
    }
  })

  return (
    <VStack w="$full" spacing="$4" alignItems="stretch">
      <Grid
        gap="$4"
        templateColumns={{ "@initial": "1fr", "@lg": "1fr 1fr" }}
        w="$full"
      >
        <Box p="$4" rounded="$lg" bgColor="$neutral2">
          <Heading size="sm" mb="$2">
            {t("manage.stats_driver_distribution")}
          </Heading>
          <EChart option={driverOption()} />
        </Box>
        <Box p="$4" rounded="$lg" bgColor="$neutral2">
          <Heading size="sm" mb="$2">
            {t("manage.stats_storage_usage")}
          </Heading>
          <EChart option={usageOption()} />
        </Box>
      </Grid>
    </VStack>
  )
}

export default StatsWidget
