// Classified request client. Wraps the shared axios instance `r` (baseURL and
// Authorization come from it) and never throws: every outcome is an ApiResult.
import type { AxiosRequestConfig } from "axios"
import type { UnifiedError } from "../contracts/task"
import { r } from "~/utils/request"
import {
  classifyBusinessCode,
  classifyStatus,
  redact,
  toUnifiedError,
  type Classified,
  type TransportFailure,
} from "./classify"

export type ApiResult<T> =
  | { ok: true; data: T; requestId?: string }
  | { ok: false; error: UnifiedError; requestId?: string }

export interface ApiOptions {
  body?: unknown
  params?: Record<string, unknown>
  signal?: AbortSignal
  timeoutMs?: number
  /**
   * Extra request headers. The shared instance defaults to a JSON content type,
   * so a multipart body has to say so, or it is sent as JSON.
   */
  headers?: Record<string, string>
}

type Method = "get" | "post" | "put" | "delete" | "patch"

const isTransport = (v: any): v is TransportFailure =>
  v && typeof v === "object" && typeof v.transport === "string"

const fixed = (c: Classified["category"]): Classified => {
  switch (c) {
    case "canceled":
      return { category: c, code: "canceled", retryable: false }
    case "timeout":
      return { category: c, code: "timeout", retryable: true }
    case "network":
      return { category: c, code: "network", retryable: true }
    default:
      return { category: c, code: c, retryable: false }
  }
}

export async function api<T>(
  method: Method,
  url: string,
  opts: ApiOptions = {},
): Promise<ApiResult<T>> {
  const config: AxiosRequestConfig = {
    method,
    url,
    data: opts.body,
    params: opts.params,
    signal: opts.signal,
    timeout: opts.timeoutMs,
    headers: opts.headers,
  }
  let resp: any
  try {
    resp = await r.request(config)
  } catch (e) {
    // The interceptor normally swallows failures; this covers a bypass.
    const message = e instanceof Error ? e.message : String(e)
    return {
      ok: false,
      error: toUnifiedError(fixed("network"), message),
    }
  }
  if (isTransport(resp)) {
    const c =
      resp.transport === "canceled" ||
      resp.transport === "timeout" ||
      resp.transport === "network"
        ? fixed(resp.transport)
        : resp.code !== undefined
          ? classifyStatus(resp.code)
          : fixed(resp.transport)
    return {
      ok: false,
      requestId: resp.requestId,
      error: toUnifiedError(c, resp.message, {
        httpStatus: resp.code && resp.code > 0 ? resp.code : undefined,
        requestId: resp.requestId,
      }),
    }
  }
  const requestId: string | undefined =
    typeof resp?.request_id === "string" ? resp.request_id : undefined
  if (resp && resp.code === 200) {
    return { ok: true, data: resp.data as T, requestId }
  }
  const code = typeof resp?.code === "number" ? resp.code : 0
  const message =
    typeof resp?.message === "string" ? redact(resp.message) : "unknown error"
  return {
    ok: false,
    requestId,
    error: toUnifiedError(classifyBusinessCode(code), message, {
      httpStatus: 200,
      requestId,
      details: { businessCode: code },
    }),
  }
}

export const apiGet = <T>(url: string, opts?: ApiOptions) =>
  api<T>("get", url, opts)
export const apiPost = <T>(url: string, opts?: ApiOptions) =>
  api<T>("post", url, opts)

/**
 * The numeric code legacy consumers branch on: the business code for a
 * failure inside an HTTP 200, otherwise the HTTP status (0 when none arrived).
 */
export const legacyCode = (error: UnifiedError): number => {
  const d = error.details as { businessCode?: number } | undefined
  return d?.businessCode ?? error.httpStatus ?? 0
}
