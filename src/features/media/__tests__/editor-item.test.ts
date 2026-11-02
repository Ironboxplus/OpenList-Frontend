import { describe, expect, it, vi } from "vitest"
import type { MediaItem } from "~/types"

vi.mock("~/utils/config", () => ({ api: "" }))
vi.mock("~/store/media", () => ({ mediaStatus: () => ({}) }))

import { detailsBody, fromMediaItem, isEmptyBody } from "../editor-item"

const media = (over: Partial<MediaItem> = {}): MediaItem =>
  ({
    path: "/lib/Show",
    video_type: "anime",
    scraped_name: "Show",
    file_name: "Show.mkv",
    original_title: "ショー",
    release_date: "2021-04-02",
    plot: "p",
    description: "d",
    locked: true,
    confidence: 0.9,
    candidates: JSON.stringify([
      { provider: "tmdb", id: "tv/1", title: "A", year: 2020, score: 0.5 },
    ]),
    cover: "",
    cover_url: "/api/public/media/thumb?path=%2Fa&sign=s",
    ...over,
  }) as MediaItem

describe("fromMediaItem", () => {
  it("reads the editor's view off a public media item", () => {
    const it = fromMediaItem(media())
    expect(it).toMatchObject({
      path: "/lib/Show",
      kind: "anime",
      title: "Show",
      original_title: "ショー",
      year: 2021,
      overview: "p",
      locked: true,
      confidence: 0.9,
      cover: "/api/public/media/thumb?path=%2Fa&sign=s",
    })
    expect(it.candidates.map((c) => c.id)).toEqual(["tv/1"])
  })

  it("treats a video_type the editor does not know as a movie, and missing curation as sure", () => {
    const it = fromMediaItem(
      media({
        video_type: "",
        confidence: undefined,
        candidates: undefined,
        release_date: "",
      }),
    )
    expect(it.kind).toBe("movie")
    expect(it.confidence).toBe(1)
    expect(it.candidates).toEqual([])
    expect(it.year).toBe(0)
  })
})

describe("detailsBody", () => {
  const item = fromMediaItem(media())
  const same = {
    title: "Show",
    original_title: "ショー",
    year: "2021",
    overview: "p",
  }

  it("is just the path when nothing changed", () => {
    expect(isEmptyBody(detailsBody(item, same))).toBe(true)
  })

  it("carries only the changed fields", () => {
    expect(
      detailsBody(item, { ...same, title: " New ", year: "2022" }),
    ).toEqual({
      path: "/lib/Show",
      title: "New",
      year: 2022,
    })
  })

  it("lets the original title and the overview be cleared, but never the title", () => {
    expect(
      detailsBody(item, {
        ...same,
        title: "",
        original_title: "",
        overview: "",
      }),
    ).toEqual({ path: "/lib/Show", original_title: "", overview: "" })
  })

  it("leaves out a year that is not a number", () => {
    expect(isEmptyBody(detailsBody(item, { ...same, year: "abc" }))).toBe(true)
  })
})
