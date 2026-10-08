import { beforeEach, describe, expect, it, vi } from "vitest"

const request = vi.fn()
vi.mock("~/utils/request", () => ({
  r: { request: (c: unknown) => request(c) },
}))

import { fetchPackDefaults } from "../api"

beforeEach(() => request.mockReset())

describe("fetchPackDefaults", () => {
  it("returns the backend's defaults", async () => {
    const d = {
      enabled: true,
      threshold: 8388608,
      min_files: 8,
      max_pack_bytes: 1073741824,
    }
    request.mockResolvedValue({ code: 200, message: "success", data: d })
    expect(await fetchPackDefaults()).toEqual(d)
    expect(request.mock.calls[0][0]).toMatchObject({
      method: "get",
      url: "/admin/sync/pack_defaults",
    })
  })

  it("is undefined on an older backend (404), so the options stay hidden", async () => {
    request.mockResolvedValue({
      code: 404,
      message: "nf",
      transport: "validation",
    })
    expect(await fetchPackDefaults()).toBeUndefined()
  })

  it("is undefined when the request fails outright", async () => {
    request.mockResolvedValue({
      message: "Network Error",
      transport: "network",
    })
    expect(await fetchPackDefaults()).toBeUndefined()
  })
})
