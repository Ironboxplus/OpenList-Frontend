import { describe, expect, it, vi } from "vitest"
import type { MediaItem } from "~/types"

vi.mock("~/utils/config", () => ({ api: "" }))
vi.mock("~/store/media", () => ({ mediaStatus: () => ({}) }))

import { absoluteOf, cardOf, episodesOf, itemOf, relativeTo } from "../adapt"

const view = (over: Partial<MediaItem> = {}): MediaItem =>
  ({
    path: "/lib/Show",
    video_type: "tv",
    scraped_name: "Show",
    file_name: "Show",
    release_date: "2019-05-01",
    ratings: { douban: 8.7, imdb: "7.9" },
    cover_url: "/api/public/media/thumb?path=%2Fa&sign=s",
    genre: "Drama,Mystery",
    plot: "plot",
    original_title: "Original",
    external_ids: '{"tmdb":"tv/1"}',
    backdrop_url: "/b",
    source: "scraper",
    confidence: 0.4,
    locked: false,
    candidates:
      '[{"provider":"tmdb","id":"tv/2","title":"X","year":2019,"score":0.5}]',
    scraped_at: null,
    ...over,
  }) as MediaItem

describe("cardOf / itemOf", () => {
  it("maps a list entry onto a poster card", () => {
    expect(cardOf(view())).toEqual({
      path: "/lib/Show",
      kind: "tv",
      title: "Show",
      year: 2019,
      ratings: { douban: 8.7, imdb: "7.9" },
      poster_url: "/api/public/media/thumb?path=%2Fa&sign=s",
    })
  })

  it("a work without a video_type is a movie, a collection keeps its mosaic", () => {
    expect(cardOf(view({ video_type: "" })).kind).toBe("movie")
    const c = cardOf(
      view({ video_type: "collection", child_posters: ["/a", "/b"] }),
    )
    expect(c.kind).toBe("collection")
    expect(c.child_posters).toEqual(["/a", "/b"])
  })

  it("the header item parses the JSON strings of the API", () => {
    const it = itemOf(view())
    expect(it.external_ids).toEqual({ tmdb: "tv/1" })
    expect(it.genres).toEqual(["Drama", "Mystery"])
    expect(it.overview).toBe("plot")
    expect(it.candidates?.map((c) => c.id)).toEqual(["tv/2"])
    expect(it.confidence).toBe(0.4)
  })
})

describe("episodesOf", () => {
  it("keeps the fields the file list shows and tolerates a missing list", () => {
    expect(
      episodesOf([
        {
          file_name: "S1/e1.mkv",
          season: 1,
          episode: 1,
          title: "Pilot",
          overview: "o",
          still_url: "/s",
        },
      ]),
    ).toEqual([
      {
        file_name: "S1/e1.mkv",
        season: 1,
        episode: 1,
        title: "Pilot",
        overview: "o",
      },
    ])
    expect(episodesOf(undefined)).toEqual([])
  })
})

describe("scan paths and the user's base path", () => {
  it("turns an absolute scan path into the browser's path", () => {
    expect(relativeTo("/data/anime", "/data")).toBe("/anime")
    expect(relativeTo("/data", "/data")).toBe("/")
    expect(relativeTo("/data/anime/", "/")).toBe("/data/anime")
    expect(relativeTo("/other/anime", "/data")).toBeUndefined()
    expect(relativeTo("/database", "/data")).toBeUndefined()
  })

  it("and back", () => {
    expect(absoluteOf("/anime", "/data")).toBe("/data/anime")
    expect(absoluteOf("/anime", "/")).toBe("/anime")
    expect(absoluteOf("/", "/data")).toBe("/data")
    expect(absoluteOf("/anime/", undefined)).toBe("/anime")
  })
})
