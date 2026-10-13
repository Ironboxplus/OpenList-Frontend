import { createMemo } from "solid-js"
import { EChart } from "~/components/EChart"
import { useT } from "~/hooks"
import type { StatsOverview } from "~/platform/api/stats"
import { dailyOption, speedOption } from "./stats-charts"

/** The two traffic charts; a separate chunk because it pulls in echarts. */
const TrafficChart = (props: {
  kind: "speed" | "daily"
  data: StatsOverview["traffic"]
  height: string
}) => {
  const t = useT()
  const option = createMemo(() => {
    const labels = {
      down: t("dashboard.traffic.download"),
      up: t("dashboard.traffic.upload"),
    }
    return props.kind === "speed"
      ? speedOption(props.data.series, labels)
      : dailyOption(props.data.daily, labels)
  })
  return <EChart option={option()} height={props.height} />
}

export default TrafficChart
