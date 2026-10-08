import { beforeEach, describe, expect, it, vi } from "vitest"

const request = vi.fn()
vi.mock("~/utils/request", () => ({
  r: { request: (c: unknown) => request(c) },
}))

import { api } from "../client"

beforeEach(() => {
  request.mockReset()
})

describe("api()", () => {
  it("returns data on code 200", async () => {
    request.mockResolvedValue({ code: 200, message: "ok", data: { a: 1 } })
    const out = await api<{ a: number }>("get", "/x")
    expect(out).toEqual({ ok: true, data: { a: 1 }, requestId: undefined })
  })

  it("forwards method, body, params, signal and timeout", async () => {
    request.mockResolvedValue({ code: 200, data: null })
    const signal = new AbortController().signal
    await api("post", "/x", {
      body: { b: 1 },
      params: { p: 2 },
      signal,
      timeoutMs: 50,
    })
    expect(request).toHaveBeenCalledWith({
      method: "post",
      url: "/x",
      data: { b: 1 },
      params: { p: 2 },
      signal,
      timeout: 50,
    })
  })

  const table: [string, unknown, string, string][] = [
    [
      "cancel",
      { code: -1, message: "canceled", transport: "canceled" },
      "canceled",
      "canceled",
    ],
    [
      "timeout",
      { message: "timeout", transport: "timeout" },
      "timeout",
      "timeout",
    ],
    [
      "network",
      { message: "Network Error", transport: "network" },
      "network",
      "network",
    ],
    [
      "http 401",
      { code: 401, message: "m", transport: "auth" },
      "auth",
      "unauthorized",
    ],
    [
      "http 403",
      { code: 403, message: "m", transport: "permission" },
      "permission",
      "forbidden",
    ],
    [
      "http 404",
      { code: 404, message: "m", transport: "validation" },
      "validation",
      "not_found",
    ],
    [
      "http 429",
      { code: 429, message: "m", transport: "rate_limited" },
      "rate_limited",
      "rate_limited",
    ],
    [
      "http 503",
      { code: 503, message: "m", transport: "internal" },
      "internal",
      "http_503",
    ],
    ["200 + 401", { code: 401, message: "expired" }, "auth", "unauthorized"],
    ["200 + 403", { code: 403, message: "no" }, "permission", "forbidden"],
    ["200 + 404", { code: 404, message: "gone" }, "validation", "not_found"],
    [
      "200 + 429",
      { code: 429, message: "slow" },
      "rate_limited",
      "rate_limited",
    ],
    ["200 + 500", { code: 500, message: "bad" }, "internal", "http_500"],
    [
      "200 + other",
      { code: 402, message: "needs otp" },
      "provider",
      "code_402",
    ],
  ]
  it.each(table)("%s", async (_n, resp, category, code) => {
    request.mockResolvedValue(resp)
    const out = await api("get", "/x")
    expect(out.ok).toBe(false)
    if (!out.ok) {
      expect(out.error.category).toBe(category)
      expect(out.error.code).toBe(code)
    }
  })

  it("keeps the backend message", async () => {
    request.mockResolvedValue({ code: 500, message: "storage x is down" })
    const out = await api("get", "/x")
    expect(!out.ok && out.error.message).toBe("storage x is down")
  })

  it("never leaks tokens into the error", async () => {
    request.mockResolvedValue({
      code: 500,
      message: "GET /d/a?sign=SECRET failed",
    })
    const out = await api("get", "/x")
    expect(JSON.stringify(out)).not.toContain("SECRET")
  })

  it("converts a thrown error into network", async () => {
    request.mockRejectedValue(new Error("weird"))
    const out = await api("get", "/x")
    expect(!out.ok && out.error.category).toBe("network")
  })
})
