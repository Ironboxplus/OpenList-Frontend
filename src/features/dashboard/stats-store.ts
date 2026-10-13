import { createSignal, onCleanup, onMount } from "solid-js"
import { getStatsOverview, type StatsOverview } from "~/platform/api/stats"
import { createPoller } from "~/utils/poll"

export const STATS_POLL_MS = 5000

/**
 * The statistics overview, refreshed every few seconds while the page that
 * calls this is open and the tab is visible. Admin-only: only an admin view may
 * call it. A failed round keeps the last good data and reports the error
 * (cleared by the next success); `retry` asks again at once.
 */
export const createStatsOverview = () => {
  const [data, setData] = createSignal<StatsOverview>()
  const [error, setError] = createSignal<string>()
  const poller = createPoller({
    intervalMs: STATS_POLL_MS,
    tick: async () => {
      const r = await getStatsOverview()
      if (r.ok) {
        setData(r.data)
        setError(undefined)
      } else {
        setError(r.error.message)
      }
    },
  })
  onMount(poller.start)
  onCleanup(poller.stop)
  return {
    data,
    error,
    loaded: () => data() !== undefined,
    retry: poller.refresh,
  }
}

export type StatsOverviewStore = ReturnType<typeof createStatsOverview>
