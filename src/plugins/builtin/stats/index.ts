import { lazy } from "solid-js"
import type { Plugin } from "../../registry"

// Charts pull in echarts; lazy-load so they don't bloat the initial bundle.
const StatsWidget = lazy(() => import("./StatsWidget"))

export const statsPlugin: Plugin = {
  id: "builtin.stats",
  name: "Dashboard Stats",
  contributions: [
    { slot: "manage-dashboard", component: StatsWidget, order: 0 },
  ],
}
