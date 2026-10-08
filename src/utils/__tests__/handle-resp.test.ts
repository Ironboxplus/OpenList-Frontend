import { beforeEach, describe, expect, it, vi } from "vitest"
import { bus } from "../bus"

// The utils barrel drags in hope-ui; handle_resp only needs bus and notify.
vi.mock("..", () => ({
  bus,
  notify: { error: vi.fn(), success: vi.fn() },
}))

vi.mock("~/hooks/useT", () => ({
  useT: () => (key: string) =>
    ({
      "errors.network": "Network error",
      "errors.timeout": "Request timed out",
    })[key] ?? key,
}))

import { notify } from ".."
import { handleResp } from "../handle_resp"
import type { Resp } from "~/types"

const fail = (over: Partial<Resp<null>>): Resp<null> => ({
  code: 500,
  message: "backend said no",
  data: null,
  ...over,
})

let toast: ReturnType<typeof vi.spyOn>
let emitted: string[]
beforeEach(() => {
  toast = vi.spyOn(notify, "error").mockImplementation((() => {}) as any)
  emitted = []
  bus.all.clear()
  bus.on("to", (p) => {
    emitted.push(p)
  })
})

describe("handleResp transport awareness", () => {
  const table: [string, Partial<Resp<null>>, string | undefined][] = [
    ["network", { code: undefined as any, message: "Network Error", transport: "network" }, "Network error"],
    ["timeout", { code: undefined as any, message: "timeout of 5000ms exceeded", transport: "timeout" }, "Request timed out"],
    ["canceled", { code: -1, message: "canceled", transport: "canceled" }, undefined],
    ["http 500 keeps the backend text", { code: 500, message: "disk full", transport: "internal" }, "disk full"],
    ["business error", { code: 400, message: "bad input" }, "bad input"],
  ]
  it.each(table)("%s", (_n, resp, shown) => {
    const onFail = vi.fn()
    handleResp(fail(resp), undefined, onFail)
    if (shown === undefined) expect(toast).not.toHaveBeenCalled()
    else expect(toast).toHaveBeenCalledWith(shown)
    expect(onFail).toHaveBeenCalledTimes(1)
  })

  it("success path is untouched", () => {
    const ok = vi.fn()
    handleResp({ code: 200, message: "ok", data: 1 }, ok)
    expect(ok).toHaveBeenCalledWith(1)
    expect(toast).not.toHaveBeenCalled()
  })

  it("does not send a transport failure to login", () => {
    handleResp(fail({ code: undefined as any, transport: "network" }))
    expect(emitted).toEqual([])
  })
})

describe("401 recovery", () => {
  it("redirects to login carrying path, query and hash", () => {
    window.history.pushState({}, "", "/some/dir?type=copy&x=1#frag")
    handleResp(fail({ code: 401, message: "expired" }))
    expect(emitted).toHaveLength(1)
    const redirect = new URL(emitted[0], "http://x").searchParams.get("redirect")
    expect(emitted[0].startsWith("/@login?redirect=")).toBe(true)
    expect(redirect).toBe("/some/dir?type=copy&x=1#frag")
  })

  it("auth=false never redirects", () => {
    handleResp(fail({ code: 401 }), undefined, undefined, false)
    expect(emitted).toEqual([])
  })
})
