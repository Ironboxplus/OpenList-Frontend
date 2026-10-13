import { createEffect, on, onCleanup, untrack } from "solid-js"
import * as echarts from "echarts/core"
import { PieChart, BarChart, LineChart } from "echarts/charts"
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
  LineChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
  CanvasRenderer,
])

// The dark theme paints its own page colour; the card behind the chart is the
// background.
const withOption = (option: echarts.EChartsCoreOption) => ({
  backgroundColor: "transparent",
  ...option,
})

/**
 * Thin SolidJS wrapper over an ECharts instance. Re-applies `option` reactively,
 * re-creates the chart in the other theme when the color mode changes, resizes
 * with its box and the window, and disposes on unmount.
 */
export const EChart = (props: {
  option: echarts.EChartsCoreOption
  height?: string
}) => {
  let el!: HTMLDivElement
  let chart: echarts.ECharts | undefined
  const { colorMode } = useColorMode()

  const resize = () => chart?.resize()
  let observer: ResizeObserver | undefined

  createEffect(() => {
    const dark = colorMode() === "dark"
    chart?.dispose()
    chart = echarts.init(el, dark ? "dark" : undefined)
    chart.setOption(untrack(() => withOption(props.option)))
  })
  createEffect(
    on(
      () => props.option,
      (option) => chart?.setOption(withOption(option), true),
      { defer: true },
    ),
  )
  createEffect(() => {
    window.addEventListener("resize", resize)
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(resize)
      observer.observe(el)
    }
  })

  onCleanup(() => {
    window.removeEventListener("resize", resize)
    observer?.disconnect()
    chart?.dispose()
  })

  return (
    <div ref={el} style={{ width: "100%", height: props.height ?? "300px" }} />
  )
}
