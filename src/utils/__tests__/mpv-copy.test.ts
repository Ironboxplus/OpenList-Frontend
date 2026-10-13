import { beforeEach, describe, expect, it, vi } from "vitest"

const apiPost = vi.fn()
vi.mock("~/platform/api/client", () => ({
  apiPost: (...a: unknown[]) => apiPost(...a),
}))

import { Obj, ObjType } from "~/types"
import { mpvCommand } from "../mpv-command"
import {
  buildMpvCommandFor,
  fetchSidecarSubtitles,
  isMpvMedia,
  MpvCommandDeps,
} from "../mpv-copy"

const obj = (name: string, type: ObjType, is_dir = false) =>
  ({ name, type, is_dir }) as Obj

const deps = (over: Partial<MpvCommandDeps> = {}): MpvCommandDeps => ({
  linkOf: (o) => `http://h/d/${encodeURIComponent(o.name)}`,
  pathOf: (o) => `/dir/${o.name}`,
  password: "pw",
  withSubtitles: true,
  ...over,
})

const okSubs = (urls: string[]) => ({
  ok: true,
  data: urls.map((url) => ({ url, source: "sidecar" })),
})

beforeEach(() => {
  apiPost.mockReset()
})

describe("fetchSidecarSubtitles", () => {
  it("asks for sidecar files only and returns their urls", async () => {
    apiPost.mockResolvedValue(okSubs(["http://h/p/a.srt", "http://h/p/a.ass"]))
    await expect(fetchSidecarSubtitles("/d/a.mkv", "pw")).resolves.toEqual([
      "http://h/p/a.srt",
      "http://h/p/a.ass",
    ])
    expect(apiPost).toHaveBeenCalledWith("/fs/video_subtitle", {
      body: { path: "/d/a.mkv", password: "pw", sidecar_only: true },
    })
  })

  it("treats a null list as no subtitles and throws on a failed request", async () => {
    apiPost.mockResolvedValueOnce({ ok: true, data: null })
    await expect(fetchSidecarSubtitles("/a", "")).resolves.toEqual([])
    apiPost.mockResolvedValueOnce({ ok: false, error: { message: "boom" } })
    await expect(fetchSidecarSubtitles("/a", "")).rejects.toThrow("boom")
  })
})

describe("isMpvMedia", () => {
  it("accepts video and audio files only", () => {
    expect(isMpvMedia(obj("a.mkv", ObjType.VIDEO))).toBe(true)
    expect(isMpvMedia(obj("a.flac", ObjType.AUDIO))).toBe(true)
    expect(isMpvMedia(obj("a.jpg", ObjType.IMAGE))).toBe(false)
    expect(isMpvMedia(obj("a.txt", ObjType.TEXT))).toBe(false)
    expect(isMpvMedia(obj("d", ObjType.FOLDER, true))).toBe(false)
  })
})

describe("buildMpvCommandFor", () => {
  it("requests and uses subtitles only for the media among the selection", async () => {
    apiPost.mockImplementation(async (_u, { body }) =>
      okSubs(body.path === "/dir/a.mkv" ? ["http://h/p/a.srt"] : []),
    )
    const out = await buildMpvCommandFor(
      [
        obj("a.mkv", ObjType.VIDEO),
        obj("pic.jpg", ObjType.IMAGE),
        obj("sub", ObjType.FOLDER, true),
        obj("b.mp3", ObjType.AUDIO),
      ],
      deps(),
    )
    expect(apiPost).toHaveBeenCalledTimes(2)
    for (const [, { body }] of apiPost.mock.calls) {
      expect(body.sidecar_only).toBe(true)
      expect(body.password).toBe("pw")
    }
    expect(out.count).toBe(2)
    expect(out.subtitleFailed).toBe(false)
    expect(out.command).toBe(
      'mpv "--{" "http://h/d/a.mkv" --sub-file="http://h/p/a.srt" "--}" "http://h/d/b.mp3"',
    )
  })

  it("still builds the command, without subtitles, when a lookup fails", async () => {
    apiPost.mockImplementation(async (_u, { body }) =>
      body.path === "/dir/a.mkv"
        ? { ok: false, error: { message: "403" } }
        : okSubs(["http://h/p/b.srt"]),
    )
    const out = await buildMpvCommandFor(
      [obj("a.mkv", ObjType.VIDEO), obj("b.mkv", ObjType.VIDEO)],
      deps(),
    )
    expect(out.subtitleFailed).toBe(true)
    expect(out.command).toBe(
      'mpv "http://h/d/a.mkv" "--{" "http://h/d/b.mkv" --sub-file="http://h/p/b.srt" "--}"',
    )
  })

  it("waits for every lookup and keeps at most 4 in flight", async () => {
    let inFlight = 0
    let peak = 0
    apiPost.mockImplementation(async () => {
      inFlight++
      peak = Math.max(peak, inFlight)
      await new Promise((r) => setTimeout(r, 5))
      inFlight--
      return okSubs(["http://h/p/x.srt"])
    })
    const objs = Array.from({ length: 10 }, (_, i) =>
      obj(`v${i}.mkv`, ObjType.VIDEO),
    )
    const out = await buildMpvCommandFor(objs, deps())
    expect(peak).toBe(4)
    expect(out.command.match(/--sub-file/g)).toHaveLength(10)
  })

  it("makes no request where subtitles are unavailable (share pages)", async () => {
    const out = await buildMpvCommandFor(
      [obj("a.mkv", ObjType.VIDEO)],
      deps({ withSubtitles: false }),
    )
    expect(apiPost).not.toHaveBeenCalled()
    expect(out.command).toBe('mpv "http://h/d/a.mkv"')
  })

  it("gives a single file the same text as the pure function (preview page button)", async () => {
    const subs = ["http://h/p/a.srt", "http://h/p/a.ass"]
    apiPost.mockResolvedValue(okSubs(subs))
    const out = await buildMpvCommandFor(
      [obj("a b.mkv", ObjType.VIDEO)],
      deps(),
    )
    expect(out.command).toBe(
      mpvCommand([{ url: "http://h/d/a%20b.mkv", subUrls: subs }]),
    )
  })

  it("reports nothing to copy when no media is selected", async () => {
    const out = await buildMpvCommandFor([obj("a.jpg", ObjType.IMAGE)], deps())
    expect(out.count).toBe(0)
    expect(apiPost).not.toHaveBeenCalled()
  })
})
