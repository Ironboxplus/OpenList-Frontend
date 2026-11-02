import { afterEach, describe, expect, it, vi } from "vitest"
import { getClientId } from "../client-id"

describe("getClientId", () => {
  afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it("creates one id and keeps it", () => {
    const first = getClientId()
    expect(first.length).toBeGreaterThanOrEqual(32)
    expect(getClientId()).toBe(first)
    expect(localStorage.getItem("client-id")).toBe(first)
  })

  it("keeps a stored id", () => {
    localStorage.setItem("client-id", "abc")
    expect(getClientId()).toBe("abc")
  })

  it("falls back without randomUUID", () => {
    vi.stubGlobal("crypto", {
      getRandomValues: (a: Uint8Array) => a.fill(7),
    })
    expect(getClientId()).toBe("07".repeat(16))
    vi.unstubAllGlobals()
  })

  it("survives blocked storage", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked")
    })
    const id = getClientId()
    expect(getClientId()).toBe(id)
  })
})
