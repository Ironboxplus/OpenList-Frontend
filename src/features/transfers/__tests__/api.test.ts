import { beforeEach, describe, expect, it, vi } from "vitest"

const request = vi.fn()
vi.mock("~/utils/request", () => ({ r: { request: (c: unknown) => request(c) } }))

import { fetchSyncList, fetchTache, postTache } from "../api"

beforeEach(() => {
  request.mockReset()
})

describe("transfers api over the classified client", () => {
  it("folds a success back into the legacy shape", async () => {
    request.mockResolvedValue({ code: 200, message: "success", data: [1] })
    expect(await fetchTache("copy", false)).toMatchObject({ code: 200, data: [1] })
    expect(request.mock.calls[0][0]).toMatchObject({ method: "get", url: "/task/copy/undone" })
  })

  it("passes tid as a query param", async () => {
    request.mockResolvedValue({ code: 200, data: null })
    await postTache("copy", "cancel", "a b")
    expect(request.mock.calls[0][0]).toMatchObject({
      method: "post",
      url: "/task/copy/cancel",
      params: { tid: "a b" },
    })
  })

  it("keeps http 404 as code 404 so the store can detect a missing endpoint", async () => {
    request.mockResolvedValue({ code: 404, message: "nf", transport: "validation" })
    expect(await fetchSyncList()).toMatchObject({ code: 404, transport: "validation" })
  })

  it("keeps a business 404 inside HTTP 200 as code 404", async () => {
    request.mockResolvedValue({ code: 404, message: "nf" })
    expect(await fetchSyncList()).toMatchObject({ code: 404 })
  })

  it("reports a dead network as code 0 with the transport category", async () => {
    request.mockResolvedValue({ message: "Network Error", transport: "network" })
    expect(await fetchSyncList()).toMatchObject({ code: 0, transport: "network" })
  })
})
