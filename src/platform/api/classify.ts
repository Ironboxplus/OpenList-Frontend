// Turns axios failures and non-200 business codes into the shared
// UnifiedError taxonomy (REFACTOR_PLAN §5.1). Pure: no axios instance, no DOM.
import type { ErrorCategory, UnifiedError } from "../contracts/task"

/** What the legacy axios interceptor hands to its callers on failure. */
export interface TransportFailure {
  code?: number
  message: string
  transport: ErrorCategory
  requestId?: string
}

export interface Classified {
  category: ErrorCategory
  code: string
  retryable: boolean
}

/** Drops credentials that may ride along in axios messages and URLs. */
export const redact = (text: string): string =>
  text
    .replace(
      /([?&;](?:token|sign|signature|password|pass|authorization)=)[^&\s"')]+/gi,
      "$1[redacted]",
    )
    .replace(/(Bearer\s+)[A-Za-z0-9._~+/=-]+/g, "$1[redacted]")

const byStatus = (status: number): Classified | undefined => {
  switch (true) {
    case status === 401:
      return { category: "auth", code: "unauthorized", retryable: false }
    case status === 403:
      return { category: "permission", code: "forbidden", retryable: false }
    case status === 404:
      return { category: "validation", code: "not_found", retryable: false }
    case status === 429:
      return { category: "rate_limited", code: "rate_limited", retryable: true }
    case status >= 500 && status < 600:
      return { category: "internal", code: `http_${status}`, retryable: true }
  }
  return undefined
}

/** HTTP status → category. Unmapped 4xx are the caller's fault: validation. */
export const classifyStatus = (status: number): Classified =>
  byStatus(status) ?? {
    category: "validation",
    code: `http_${status}`,
    retryable: false,
  }

/** Business code inside an HTTP 200 body. Unmapped ones come from the provider. */
export const classifyBusinessCode = (code: number): Classified =>
  byStatus(code) ?? {
    category: "provider",
    code: `code_${code}`,
    retryable: false,
  }

interface AxiosLike {
  code?: string
  name?: string
  message?: string
  response?: { status?: number; data?: unknown; headers?: unknown }
  __CANCEL__?: boolean
}

const headerOf = (headers: unknown, name: string): string | undefined => {
  if (!headers || typeof headers !== "object") return undefined
  const h = headers as { get?: (n: string) => unknown } & Record<string, unknown>
  const v = typeof h.get === "function" ? h.get(name) : h[name]
  return typeof v === "string" && v ? v : undefined
}

const bodyMessage = (data: unknown): string | undefined => {
  if (data && typeof data === "object") {
    const m = (data as { message?: unknown }).message
    if (typeof m === "string" && m) return m
  }
  return undefined
}

/** Classifies whatever axios threw. Never throws itself. */
export const classifyAxiosError = (raw: unknown): TransportFailure => {
  const e = (raw ?? {}) as AxiosLike
  const fallback = typeof e.message === "string" ? e.message : String(raw)
  const status = e.response?.status
  const requestId = headerOf(e.response?.headers, "x-request-id")
  if (e.code === "ERR_CANCELED" || e.name === "CanceledError" || e.__CANCEL__) {
    return { code: -1, message: redact(fallback), transport: "canceled" }
  }
  if (e.name === "AbortError") {
    return { code: -1, message: redact(fallback), transport: "canceled" }
  }
  if (status === undefined) {
    const timedOut =
      e.code === "ECONNABORTED" ||
      e.code === "ETIMEDOUT" ||
      /timeout/i.test(fallback)
    return {
      code: undefined,
      message: redact(fallback),
      transport: timedOut ? "timeout" : "network",
    }
  }
  return {
    code: status,
    message: redact(bodyMessage(e.response?.data) ?? fallback),
    transport: classifyStatus(status).category,
    requestId,
  }
}

export const toUnifiedError = (
  c: Classified,
  message: string,
  extra: { httpStatus?: number; requestId?: string; details?: unknown } = {},
): UnifiedError => ({
  code: c.code,
  category: c.category,
  message: redact(message),
  retryable: c.retryable,
  actions: c.retryable ? ["retry"] : [],
  httpStatus: extra.httpStatus,
  requestId: extra.requestId,
  details: extra.details,
  occurredAt: new Date().toISOString(),
})
