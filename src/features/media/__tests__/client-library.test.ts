import { describe, expect, it, vi } from "vitest"

const apiPost = vi.fn(async () => ({ ok: true, data: { id: 7 } }))
const apiGet = vi.fn()
vi.mock("~/platform/api/client", () => ({
  api: vi.fn(),
  apiGet: (...a: unknown[]) => apiGet(...a),
  apiPost: (...a: unknown[]) => apiPost(...(a as [])),
  legacyCode: (e: { code?: number }) => e.code ?? 0,
}))
vi.mock("~/store", () => ({ me: () => ({ base_path: "/data" }) }))
vi.mock("~/utils/config", () => ({ api: "" }))
vi.mock("~/store/media", () => ({ mediaStatus: () => ({}) }))

import {
  markLibrary,
  mediaClient,
  unmarkLibrary,
  uploadMediaImage,
} from "../client"

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

describe("uploading an image", () => {
  it("sends a file as multipart (the shared client defaults to JSON) and a url as JSON", async () => {
    const file = new File(["x"], "p.jpg", { type: "image/jpeg" })
    apiPost.mockClear()
    await uploadMediaImage("/lib/Show", "poster", file)
    const [url, opts] = apiPost.mock.calls[0] as unknown as [
      string,
      { body: unknown; headers: Record<string, string>; params: unknown },
    ]
    expect(url).toBe("/admin/media/curate/image")
    expect(opts.body).toBeInstanceOf(FormData)
    expect(opts.headers["Content-Type"]).toBe("multipart/form-data")
    expect(opts.params).toEqual({ path: "/lib/Show", role: "poster" })

    apiPost.mockClear()
    await uploadMediaImage("/lib/Show", "backdrop", "https://img/x.jpg")
    expect(apiPost).toHaveBeenCalledWith("/admin/media/curate/image", {
      params: { path: "/lib/Show", role: "backdrop" },
      body: { url: "https://img/x.jpg" },
    })
  })
})

describe("the media view of a directory", () => {
  const miss = { ok: false, error: { code: 404 } }
  const show = {
    path: "/lib/Show",
    video_type: "tv",
    episode_list: [
      {
        file_name: "Season 1/e1.mkv",
        season: 1,
        episode: 1,
        title: "",
        overview: "",
      },
      {
        file_name: "Season 2/e1.mkv",
        season: 2,
        episode: 1,
        title: "",
        overview: "",
      },
    ],
  }
  const serve = (calls: string[]) =>
    apiGet.mockImplementation(
      async (url: string, o?: { params?: { path?: string } }) => {
        calls.push(url + (o?.params?.path ? " " + o.params.path : ""))
        if (url === "/fs/media/list")
          return { ok: true, data: { content: [], total: 0 } }
        if (url === "/fs/media/scan_paths")
          return { ok: true, data: [{ path: "/data/lib" }] }
        if (url === "/fs/media/by_path")
          return o?.params?.path === "/lib/Show"
            ? { ok: true, data: show }
            : miss
        return miss
      },
    )

  it("inside a work's Season folder, the file list gets that season's episodes", async () => {
    const calls: string[] = []
    serve(calls)
    const fs = await mediaClient.get("/lib/Show/Season 1")
    expect(fs?.item).toBeNull()
    expect(fs?.libraries).toEqual(["/lib"])
    expect(fs?.episodes.map((e) => e.file_name)).toEqual(["e1.mkv"])
    expect(calls).toContain("/fs/media/by_path /lib/Show")
  })

  it("outside a library a miss costs no walk up", async () => {
    const calls: string[] = []
    serve(calls)
    const fs = await mediaClient.get("/elsewhere/a/b")
    expect(fs?.episodes).toEqual([])
    expect(calls.filter((c) => c.startsWith("/fs/media/by_path"))).toEqual([
      "/fs/media/by_path /elsewhere/a/b",
    ])
  })
})
