// ECharts options for the dashboard. Download and upload keep one colour pair
// in every chart. Axis ticks and tooltips use the same byte units as the cards.
import type { TrafficDay, TrafficPoint } from "~/platform/api/stats"
import { bytesText, speedText } from "./stats-model"

export const DOWNLOAD_COLOR = "#3b82f6"
export const UPLOAD_COLOR = "#f59e0b"

const axisBytes = (v: number) => bytesText(v)
const axisSpeed = (v: number) => speedText(v)

const hhmmss = (t: number) => {
  const d = new Date(t * 1000)
  const p = (n: number) => String(n).padStart(2, "0")
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

const grid = { left: 8, right: 16, top: 28, bottom: 8, containLabel: true }

/** The last five minutes of server-side speed, two filled lines. */
export const speedOption = (
  series: readonly TrafficPoint[],
  labels: { down: string; up: string },
) => ({
  animation: false,
  grid,
  legend: { top: 0, right: 0, icon: "roundRect", itemWidth: 10, itemHeight: 4 },
  tooltip: {
    trigger: "axis",
    valueFormatter: (v: number) => speedText(v),
  },
  xAxis: {
    type: "category",
    boundaryGap: false,
    data: series.map((p) => hhmmss(p.t)),
    axisLabel: { hideOverlap: true },
  },
  yAxis: {
    type: "value",
    axisLabel: { formatter: axisSpeed },
    splitLine: { lineStyle: { opacity: 0.3 } },
  },
  series: [
    {
      name: labels.down,
      type: "line",
      showSymbol: false,
      smooth: true,
      color: DOWNLOAD_COLOR,
      areaStyle: { opacity: 0.25 },
      data: series.map((p) => p.server_download),
    },
    {
      name: labels.up,
      type: "line",
      showSymbol: false,
      smooth: true,
      color: UPLOAD_COLOR,
      areaStyle: { opacity: 0.25 },
      data: series.map((p) => p.server_upload),
    },
  ],
})

/** Thirty days of server-side traffic, download and upload stacked. */
export const dailyOption = (
  days: readonly TrafficDay[],
  labels: { down: string; up: string },
) => ({
  animation: false,
  grid,
  legend: { top: 0, right: 0, icon: "roundRect", itemWidth: 10, itemHeight: 8 },
  tooltip: {
    trigger: "axis",
    axisPointer: { type: "shadow" },
    valueFormatter: (v: number) => bytesText(v),
  },
  xAxis: {
    type: "category",
    data: days.map((d) => d.day.slice(5)),
    axisLabel: { hideOverlap: true },
  },
  yAxis: {
    type: "value",
    axisLabel: { formatter: axisBytes },
    splitLine: { lineStyle: { opacity: 0.3 } },
  },
  series: [
    {
      name: labels.down,
      type: "bar",
      stack: "traffic",
      color: DOWNLOAD_COLOR,
      data: days.map((d) => d.server_download),
    },
    {
      name: labels.up,
      type: "bar",
      stack: "traffic",
      color: UPLOAD_COLOR,
      data: days.map((d) => d.server_upload),
    },
  ],
})
