import { describe, expect, it, vi } from "vitest"
import {
  assetSrc,
  baseName,
  cardRating,
  cardsByName,
  createMediaClient,
  episodeLabel,
  episodeMap,
  Lru,
  preferPoster,
  ratingBadges,
  readChoice,
  writeChoice,
  type FetchOutcome,
} from "../logic"
import type { MediaCard, MediaFs } from "../types"

describe("ratingBadges", () => {
  it("orders douban, imdb, rt, tmdb, bgm and drops empty ones", () => {
    const b = ratingBadges({
      bgm: 7.84,
      tmdb: 8.123,
      rt: "94%",
      imdb: 8.7,
      douban: 9.1,
      other: 5,
    })
    expect(b.map((x) => x.key)).toEqual(["douban", "imdb", "rt", "tmdb", "bgm"])
    expect(b.map((x) => x.text)).toEqual(["9.1", "8.7", "94%", "8.1", "7.8"])
  })

  it("ignores zero, blank, N/A and missing values", () => {
    expect(
      ratingBadges({ douban: 0, imdb: "", rt: "N/A", tmdb: undefined as any }),
    ).toEqual([])
    expect(ratingBadges(undefined)).toEqual([])
  })
})

describe("cardRating", () => {
  it("prefers Douban, falls back to IMDb, otherwise nothing", () => {
    expect(cardRating({ douban: 8.2, imdb: 7 })).toEqual({
      key: "douban",
      text: "8.2",
    })
    expect(cardRating({ imdb: 7 })).toEqual({ key: "imdb", text: "7.0" })
    expect(cardRating({ tmdb: 7 })).toBeUndefined()
    expect(cardRating({ douban: 0, imdb: 6.5 })?.key).toBe("imdb")
  })
})

describe("preferPoster", () => {
  it("is true when at least half of the sub-folders have media info", () => {
    expect(preferPoster(3, 6)).toBe(true)
    expect(preferPoster(4, 6)).toBe(true)
    expect(preferPoster(2, 6)).toBe(false)
    expect(preferPoster(1, 1)).toBe(true)
  })
  it("is false with no media or no sub-folders", () => {
    expect(preferPoster(0, 5)).toBe(false)
    expect(preferPoster(0, 0)).toBe(false)
    expect(preferPoster(2, 0)).toBe(false)
  })
})

describe("view choice storage", () => {
  const mem = () => {
    const m = new Map<string, string>()
    return {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => void m.set(k, v),
    }
  }
  it("remembers a choice per directory", () => {
    const s = mem()
    expect(readChoice(s, "/a")).toBeUndefined()
    writeChoice(s, "/a", "poster")
    writeChoice(s, "/b", "other")
    expect(readChoice(s, "/a")).toBe("poster")
    expect(readChoice(s, "/b")).toBe("other")
    writeChoice(s, "/a", "other")
    expect(readChoice(s, "/a")).toBe("other")
  })
  it("survives garbage in storage", () => {
    const s = { getItem: () => "{nope", setItem: () => {} }
    expect(readChoice(s, "/a")).toBeUndefined()
    expect(() => writeChoice(s, "/a", "poster")).not.toThrow()
  })
})

describe("episodes", () => {
  it("labels with padded season and episode", () => {
    expect(episodeLabel(1, 3)).toBe("S01E03")
    expect(episodeLabel(12, 105)).toBe("S12E105")
  })
  it("maps file names to label and title", () => {
    const m = episodeMap([
      {
        file_name: "a.S01E03.mkv",
        season: 1,
        episode: 3,
        title: "Pilot",
        overview: "",
      },
      { file_name: "b.mkv", season: 2, episode: 1, title: "  ", overview: "" },
    ])
    expect(m.get("a.S01E03.mkv")?.text).toBe("S01E03 · Pilot")
    expect(m.get("b.mkv")?.text).toBe("S02E01")
    expect(m.get("missing.mkv")).toBeUndefined()
  })
})

describe("cards by name", () => {
  const card = (path: string): MediaCard => ({
    path,
    kind: "movie",
    title: "t",
    year: 2000,
    ratings: {},
    poster_url: "",
  })
  it("keys cards by the last path segment", () => {
    const m = cardsByName([card("/m/Dune (2021)"), card("/m/Heat/")])
    expect(m.get("Dune (2021)")?.path).toBe("/m/Dune (2021)")
    expect(m.get("Heat")).toBeDefined()
    expect(baseName("/")).toBe("")
  })
})

describe("assetSrc", () => {
  it("puts relative asset paths on the API origin", () => {
    expect(assetSrc("/api/media/asset/3?v=thumb", "http://h:5244/base")).toBe(
      "http://h:5244/api/media/asset/3?v=thumb",
    )
    expect(assetSrc("https://x/y.jpg", "http://h")).toBe("https://x/y.jpg")
    expect(assetSrc("", "http://h")).toBe("")
  })
})

describe("Lru", () => {
  it("evicts the least recently used entry", () => {
    const l = new Lru<number>(2)
    l.set("a", 1)
    l.set("b", 2)
    l.get("a")
    l.set("c", 3)
    expect(l.has("a")).toBe(true)
    expect(l.has("b")).toBe(false)
    expect(l.size).toBe(2)
  })
})

describe("createMediaClient", () => {
  const data = (title: string): MediaFs => ({
    item: {
      path: "/x",
      kind: "movie",
      title,
      year: 2000,
      ratings: {},
      poster_url: "",
      original_title: "",
      external_ids: {},
      genres: [],
      overview: "",
      backdrop_url: "",
      source: "",
      confidence: 1,
      locked: false,
    },
    children: [],
    episodes: [],
  })

  it("asks once per directory and answers repeats from the cache", async () => {
    const f = vi.fn(
      async (): Promise<FetchOutcome> => ({ ok: true, data: data("A") }),
    )
    const c = createMediaClient(f)
    await c.get("/x")
    await c.get("/x/")
    expect(f).toHaveBeenCalledTimes(1)
  })

  it("shares one in-flight request between concurrent callers", async () => {
    const f = vi.fn(
      async (): Promise<FetchOutcome> => ({ ok: true, data: data("A") }),
    )
    const c = createMediaClient(f)
    await Promise.all([c.get("/x"), c.get("/x")])
    expect(f).toHaveBeenCalledTimes(1)
  })

  it("fetches again after invalidate (directory refresh)", async () => {
    let n = 0
    const f = vi.fn(
      async (): Promise<FetchOutcome> => ({ ok: true, data: data("v" + ++n) }),
    )
    const c = createMediaClient(f)
    expect((await c.get("/x"))?.item?.title).toBe("v1")
    c.invalidate("/x")
    expect((await c.get("/x"))?.item?.title).toBe("v2")
    c.invalidate()
    expect(c.size()).toBe(0)
  })

  it("keeps at most 50 directories", async () => {
    const f = vi.fn(
      async (): Promise<FetchOutcome> => ({ ok: true, data: data("A") }),
    )
    const c = createMediaClient(f)
    for (let i = 0; i < 60; i++) await c.get("/d" + i)
    expect(c.size()).toBe(50)
  })

  it("switches itself off on 404 and stops asking", async () => {
    const f = vi.fn(
      async (): Promise<FetchOutcome> => ({ ok: false, status: 404 }),
    )
    const c = createMediaClient(f)
    expect(await c.get("/x")).toBeUndefined()
    expect(c.isUnavailable()).toBe(true)
    expect(await c.get("/y")).toBeUndefined()
    expect(f).toHaveBeenCalledTimes(1)
  })

  it("a transient failure is not cached and does not switch it off", async () => {
    const f = vi
      .fn<() => Promise<FetchOutcome>>()
      .mockResolvedValueOnce({ ok: false, status: 502 })
      .mockResolvedValueOnce({ ok: true, data: data("ok") })
    const c = createMediaClient(f)
    expect(await c.get("/x")).toBeUndefined()
    expect(c.isUnavailable()).toBe(false)
    expect((await c.get("/x"))?.item?.title).toBe("ok")
  })
})
