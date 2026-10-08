// HTTP calls behind the transfers store. These are the only calls that speak
// the legacy /task/* and /admin/sync/* wire formats.
import type { SyncSnapshot, SyncSpec } from "~/platform/contracts/task"
import { r } from "~/utils/request"
import type { Resp } from "~/types"
import type { TacheRaw, TacheType, TaskAction } from "./adapter"

export type Result<T> = Resp<T>

export const fetchTache = (
  type: TacheType,
  done: boolean,
): Promise<Result<TacheRaw[] | null>> =>
  r.get(`/task/${type}/${done ? "done" : "undone"}`)

/** Single-task actions take `?tid=`, bulk ones act on the whole list. */
export const postTache = (
  type: TacheType,
  action: TaskAction,
  tid?: string,
): Promise<Result<unknown>> =>
  r.post(
    `/task/${type}/${action}${tid !== undefined ? `?tid=${encodeURIComponent(tid)}` : ""}`,
  )

export const fetchSyncList = (): Promise<Result<SyncSnapshot[] | null>> =>
  r.get("/admin/sync/list")

export const fetchSyncHistory = (
  limit = 50,
): Promise<Result<SyncSnapshot[] | null>> =>
  r.get(`/admin/sync/history?limit=${limit}`)

export const fetchSyncJob = (
  id: string,
  events = true,
): Promise<Result<SyncSnapshot>> =>
  r.get(`/admin/sync/get?id=${encodeURIComponent(id)}&events=${events}`)

export const runSync = (spec: Partial<SyncSpec>): Promise<Result<SyncSnapshot>> =>
  r.post("/admin/sync/run", spec)

export const cancelSync = (id: string): Promise<Result<unknown>> =>
  r.post(`/admin/sync/cancel?id=${encodeURIComponent(id)}`)

export const getBwLimit = (): Promise<
  Result<{ bytes_per_second: number }>
> => r.get("/admin/sync/bwlimit")

export const setBwLimit = (
  rate: string,
): Promise<Result<{ bytes_per_second: number }>> =>
  r.post("/admin/sync/bwlimit", { rate })
