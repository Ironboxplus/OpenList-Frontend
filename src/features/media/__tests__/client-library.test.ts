import { describe, expect, it, vi } from "vitest"

const apiPost = vi.fn(async () => ({ ok: true, data: { id: 7 } }))
const apiGet = vi.fn()
vi.mock("~/platform/api/client", () => ({
  api: vi.fn(),
  apiGet: (...a: unknown[]) => apiGet(...a),
  apiPost: (...a: unknown[]) => apiPost(...(a as [])),
  legacyCode: () => 0,
}))
vi.mock("~/store", () => ({ me: () => ({ base_path: "/data" }) }))
vi.mock("~/utils/config", () => ({ api: "" }))
vi.mock("~/store/media", () => ({ mediaStatus: () => ({}) }))

import { markLibrary, unmarkLibrary } from "../client"

describe("marking a library", () => {
  it("creates a merged video scan path at the folder, in the server's paths", async () => {
    await markLibrary("/anime")
    expect(apiPost).toHaveBeenCalledWith("/admin/media/scan_paths/create", {
      body: {
        media_type: "video",
        name: "anime",
        path: "/data/anime",
        path_merge: true,
        enable_scrape: true,
      },
    })
  })

  it("unmarking deletes the scan path that is at the folder, and says so when there is none", async () => {
    apiGet.mockResolvedValueOnce({
      ok: true,
      data: [
        { id: 3, path: "/data/other/" },
        { id: 4, path: "/data/anime/" },
      ],
    })
    apiPost.mockClear()
    await unmarkLibrary("/anime")
    expect(apiPost).toHaveBeenCalledWith("/admin/media/scan_paths/delete", {
      params: { id: 4 },
    })

    apiGet.mockResolvedValueOnce({ ok: true, data: [] })
    apiPost.mockClear()
    const out = await unmarkLibrary("/anime")
    expect(out.ok).toBe(false)
    expect(apiPost).not.toHaveBeenCalled()
  })
})
