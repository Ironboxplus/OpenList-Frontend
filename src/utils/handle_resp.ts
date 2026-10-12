import { recordError } from "~/features/notifications/service"
import { respCategory } from "~/platform/api/classify"
import { Resp } from "~/types"
import { useT } from "~/hooks/useT"
import { bus, notify } from "."
import { loginUrlFor } from "./redirect"

/**
 * What the user should read for a failed response. Requests that never
 * completed get a fixed i18n sentence instead of axios's English message;
 * business failures keep the backend text. Canceled requests have none.
 */
export const failureMessage = (resp: Resp<unknown>): string | undefined => {
  switch (resp.transport) {
    case "canceled":
      return undefined
    case "network":
      return useT()("errors.network")
    case "timeout":
      return useT()("errors.timeout")
    default:
      return resp.message
  }
}

export const handleResp = <T>(
  resp: Resp<T>,
  success?: (data: T) => void,
  fail?: (message: string, code: number) => void,
  auth: boolean = true,
  notify_error: boolean = true,
  notify_success?: boolean,
) => {
  if (resp.code === 200) {
    notify_success && notify.success(resp.message)
    success?.(resp.data)
  } else {
    const shown = failureMessage(resp)
    notify_error && shown !== undefined && notify.error(shown)
    // Failures the caller chose to keep quiet (background polls) stay out of
    // the error center too; what is recorded is what the user was told.
    if (notify_error) {
      recordError({
        category: respCategory(resp),
        source: resp.source ?? "api",
        message: shown,
        detail: [
          resp.code !== undefined && `code ${resp.code}`,
          resp.requestId && `request ${resp.requestId}`,
        ]
          .filter(Boolean)
          .join(" · "),
      })
    }
    if (auth && resp.code === 401) {
      if (location.pathname === "/@manage") {
        bus.emit("to", "/")
      } else {
        bus.emit("to", loginUrlFor(location))
      }
      return
    }
    fail?.(shown ?? resp.message, resp.code)
  }
}

export const handleRespWithoutAuth = <T>(
  resp: Resp<T>,
  success?: (data: T) => void,
  fail?: (message: string, code?: number) => void,
  notify_error: boolean = true,
) => {
  return handleResp(resp, success, fail, false, notify_error)
}

export const handleRespWithoutNotify = <T>(
  resp: Resp<T>,
  success?: (data: T) => void,
  fail?: (message: string, code?: number) => void,
  auth: boolean = true,
) => {
  return handleResp(resp, success, fail, auth, false)
}

export const handleRespWithoutAuthAndNotify = <T>(
  resp: Resp<T>,
  success?: (data: T) => void,
  fail?: (message: string, code?: number) => void,
) => {
  return handleResp(resp, success, fail, false, false)
}

export const handleRespWithNotifySuccess = <T>(
  resp: Resp<T>,
  success?: (data: T) => void,
  fail?: (message: string, code?: number) => void,
  auth: boolean = true,
  notify_error: boolean = true,
) => {
  return handleResp(resp, success, fail, auth, notify_error, true)
}
