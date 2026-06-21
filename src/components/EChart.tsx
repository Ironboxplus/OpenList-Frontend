import { onCleanup, onMount, createEffect } from "solid-js"
import * as echarts from "echarts/core"
import { PieChart, BarChart } from "echarts/charts"
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
} from "echarts/components"
import { CanvasRenderer } from "echarts/renderers"
import { useColorMode } from "@hope-ui/solid"

echarts.use([
  PieChart,
  BarChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
  CanvasRenderer,
])

/**
 * Thin SolidJS wrapper over an ECharts instance. Re-applies `option` reactively,
 * follows the color mode, resizes with the window, and disposes on unmount.
 */
export const EChart = (props: {
  option: echarts.EChartsCoreOption
  height?: string
}) => {
  let el!: HTMLDivElement
  let chart: echarts.ECharts | undefined
  const { colorMode } = useColorMode()

  const resize = () => chart?.resize()

  onMount(() => {
    chart = echarts.init(el, colorMode() === "dark" ? "dark" : undefined)
    chart.setOption(props.option)
    window.addEventListener("resize", resize)
  })

  createEffect(() => {
    chart?.setOption(props.option, true)
  })

  onCleanup(() => {
    window.removeEventListener("resize", resize)
    chart?.dispose()
  })

  return (
    <div ref={el} style={{ width: "100%", height: props.height ?? "300px" }} />
  )
}
