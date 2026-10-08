// HTTP calls behind the transfers store. These are the only calls that speak
// the legacy /task/* and /admin/sync/* wire formats. Every request goes through
// the classified api() client; `Result` is its outcome folded back into the
// {code, message, data} shape the store and dialogs already branch on.
import type {
  PackOptions,
  SyncSnapshot,
  SyncSpec,
} from "~/platform/contracts/task"
import { api, legacyCode, type ApiResult } from "~/platform/api/client"
import type { Resp } from "~/types"
import type { TacheRaw, TacheType, TaskAction } from "./adapter"

export type Result<T> = Resp<T>

const toResult = async <T>(call: Promise<ApiResult<T>>): Promise<Result<T>> => {
  const out = await call
  if (out.ok) return { code: 200, message: "success", data: out.data }
  const { error } = out
  return {
    code: legacyCode(error),
    message: error.message,
    data: null as T,
    transport: error.category,
    requestId: error.requestId,
  }
}

export const fetchTache = (
  type: TacheType,
  done: boolean,
): Promise<Result<TacheRaw[] | null>> =>
  toResult(api("get", `/task/${type}/${done ? "done" : "undone"}`))

/** Single-task actions take `?tid=`, bulk ones act on the whole list. */
export const postTache = (
  type: TacheType,
  action: TaskAction,
  tid?: string,
): Promise<Result<unknown>> =>
  toResult(
    api("post", `/task/${type}/${action}`, {
      params: tid !== undefined ? { tid } : undefined,
    }),
  )

export const fetchSyncList = (): Promise<Result<SyncSnapshot[] | null>> =>
  toResult(api("get", "/admin/sync/list"))

export const fetchSyncHistory = (
  limit = 50,
): Promise<Result<SyncSnapshot[] | null>> =>
  toResult(api("get", "/admin/sync/history", { params: { limit } }))

export const fetchSyncJob = (
  id: string,
  events = true,
): Promise<Result<SyncSnapshot>> =>
  toResult(api("get", "/admin/sync/get", { params: { id, events } }))

export const runSync = (
  spec: Partial<SyncSpec>,
): Promise<Result<SyncSnapshot>> =>
  toResult(api("post", "/admin/sync/run", { body: spec }))

/**
 * Defaults of the pack options, or undefined when the backend has none (an
 * older server answers 404): then the feature is simply not offered.
 */
export const fetchPackDefaults = async (): Promise<PackOptions | undefined> => {
  const out = await api<PackOptions>("get", "/admin/sync/pack_defaults")
  return out.ok ? out.data : undefined
}

export const cancelSync = (id: string): Promise<Result<unknown>> =>
  toResult(api("post", "/admin/sync/cancel", { params: { id } }))

export const getBwLimit = (): Promise<Result<{ bytes_per_second: number }>> =>
  toResult(api("get", "/admin/sync/bwlimit"))

export const setBwLimit = (
  rate: string,
): Promise<Result<{ bytes_per_second: number }>> =>
  toResult(api("post", "/admin/sync/bwlimit", { body: { rate } }))
