import { describe, expect, it } from "vitest"
import {
  classifyAxiosError,
  classifyBusinessCode,
  classifyStatus,
  redact,
} from "../classify"

const httpErr = (status: number, data?: unknown, headers?: unknown) => ({
  message: `Request failed with status code ${status}`,
  response: { status, data, headers },
})

describe("classifyAxiosError", () => {
  const cases: [string, unknown, string, number | undefined][] = [
    [
      "axios cancel",
      { code: "ERR_CANCELED", name: "CanceledError", message: "canceled" },
      "canceled",
      -1,
    ],
    ["abort", { name: "AbortError", message: "aborted" }, "canceled", -1],
    [
      "timeout code",
      { code: "ECONNABORTED", message: "timeout of 100ms exceeded" },
      "timeout",
      undefined,
    ],
    [
      "etimedout",
      { code: "ETIMEDOUT", message: "connect ETIMEDOUT" },
      "timeout",
      undefined,
    ],
    [
      "network error",
      { code: "ERR_NETWORK", message: "Network Error" },
      "network",
      undefined,
    ],
    ["no response, unknown", { message: "boom" }, "network", undefined],
    ["401", httpErr(401), "auth", 401],
    ["403", httpErr(403), "permission", 403],
    ["404", httpErr(404), "validation", 404],
    ["429", httpErr(429), "rate_limited", 429],
    ["500", httpErr(500), "internal", 500],
    ["502", httpErr(502), "internal", 502],
    ["400", httpErr(400), "validation", 400],
  ]
  it.each(cases)("%s", (_n, err, category, code) => {
    const out = classifyAxiosError(err)
    expect(out.transport).toBe(category)
    expect(out.code).toBe(code)
  })

  it("keeps the backend message from an error body", () => {
    expect(
      classifyAxiosError(httpErr(500, { message: "disk full" })).message,
    ).toBe("disk full")
  })

  it("reads request id from headers", () => {
    const out = classifyAxiosError(
      httpErr(500, undefined, { "x-request-id": "r-1" }),
    )
    expect(out.requestId).toBe("r-1")
  })

  it("never throws on junk", () => {
    expect(classifyAxiosError(undefined).transport).toBe("network")
    expect(classifyAxiosError(null).transport).toBe("network")
    expect(classifyAxiosError("x").transport).toBe("network")
  })

  it("strips tokens from messages", () => {
    const out = classifyAxiosError({
      message: "failed https://h/d/a?sign=SECRET&x=1 Bearer abc.def",
    })
    expect(out.message).not.toContain("SECRET")
    expect(out.message).not.toContain("abc.def")
  })
})

describe("classifyStatus / classifyBusinessCode", () => {
  it("maps http statuses", () => {
    expect(classifyStatus(404)).toMatchObject({
      category: "validation",
      code: "not_found",
    })
    expect(classifyStatus(503).category).toBe("internal")
    expect(classifyStatus(418).category).toBe("validation")
  })
  it("maps business codes with the same table, unknown to provider", () => {
    expect(classifyBusinessCode(401).category).toBe("auth")
    expect(classifyBusinessCode(403).category).toBe("permission")
    expect(classifyBusinessCode(404).code).toBe("not_found")
    expect(classifyBusinessCode(429).category).toBe("rate_limited")
    expect(classifyBusinessCode(500).category).toBe("internal")
    expect(classifyBusinessCode(402).category).toBe("provider")
    expect(classifyBusinessCode(400).category).toBe("provider")
  })
})

describe("redact", () => {
  it("masks query credentials", () => {
    expect(redact("a?token=abc&b=1")).toBe("a?token=[redacted]&b=1")
    expect(redact("x&password=pw")).toBe("x&password=[redacted]")
  })
})
