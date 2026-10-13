import { apiGet } from "./client"

/** One number per kind of relayed traffic (bytes, or bytes per second). */
export interface TrafficCounts {
  server_download: number
  server_upload: number
  client_download: number
  client_upload: number
}

export interface TrafficPoint extends TrafficCounts {
  /** Unix seconds. */
  t: number
}

export interface TrafficDay extends TrafficCounts {
  /** Server-local `YYYY-MM-DD`. */
  day: string
}

export interface MediaStats {
  movie: number
  tv: number
  anime: number
  collection: number
  episodes: number
  unscraped: number
}

/** GET /admin/stats/overview (admin only). Traffic is that of the answering node. */
export interface StatsOverview {
  node: string
  traffic: {
    now_bps: TrafficCounts
    series: TrafficPoint[]
    today: TrafficCounts
    month: TrafficCounts
    total: TrafficCounts
    daily: TrafficDay[]
  }
  media: MediaStats
}

export const getStatsOverview = (signal?: AbortSignal) =>
  apiGet<StatsOverview>("/admin/stats/overview", { signal })
