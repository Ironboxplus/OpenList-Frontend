import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { MediaFs, MediaItem } from "../types"

// ~/hooks and ~/store pull in hope-ui, which vitest cannot load.
vi.mock("~/hooks", async () => {
  const i18n = await import("@solid-primitives/i18n")
  const { dict } = await import("~/lang/en/entry")
  const flat = i18n.flatten(dict) as Record<string, string>
  return {
    useT: () => (key: string, params?: Record<string, string | number>) => {
      const tpl = flat[key]
      if (typeof tpl !== "string") return key
      return params ? i18n.resolveTemplate(tpl, params) : tpl
    },
    useRouter: () => ({ pathname: () => "/lib/Show" }),
  }
})
vi.mock("~/store", () => ({
  me: () => ({ role: 2 }),
  password: () => "",
  objStore: { objs: [] },
}))
vi.mock("~/utils/config", () => ({ api: "http://127.0.0.1:5244" }))
vi.mock("../client", () => ({
  searchMedia: vi.fn(),
  scrapeMedia: vi.fn(),
  deleteMedia: vi.fn(),
  setMediaMeta: vi.fn(),
  mediaClient: {},
}))

import * as client from "../client"
import { MediaHeaderCard } from "../MediaHeader"
import { setMediaFor, editorPath, openMediaEditor } from "../state"

const item = (over: Partial<MediaItem> = {}): MediaItem => ({
  path: "/lib/Show",
  kind: "tv",
  title: "A Show",
  year: 2021,
  ratings: { imdb: 8.1, douban: 9.0 },
  poster_url: "/api/media/asset/1?v=thumb&sign=x",
  original_title: "原名",
  external_ids: {},
  genres: ["Drama"],
  overview: "x".repeat(200),
  backdrop_url: "/api/media/asset/2?v=orig&sign=y",
  source: "tmdb",
  confidence: 1,
  locked: false,
  ...over,
})

afterEach(() => {
  setMediaFor("", undefined)
  vi.clearAllMocks()
})

describe("MediaHeaderCard", () => {
  it("with a backdrop: blurred backdrop, poster, ratings in order, folded overview", () => {
    render(() => <MediaHeaderCard item={item()} />)
    const root = document.querySelector("[data-media-header]")!
    expect(root.hasAttribute("data-has-backdrop")).toBe(true)
    expect(
      document.querySelector("[data-media-backdrop]")?.getAttribute("src"),
    ).toBe("http://127.0.0.1:5244/api/media/asset/2?v=orig&sign=y")
    expect(
      document.querySelector("[data-media-poster] img")?.getAttribute("src"),
    ).toContain("/api/media/asset/1")
    const order = [...document.querySelectorAll("[data-rating]")].map((e) =>
      e.getAttribute("data-rating"),
    )
    expect(order).toEqual(["douban", "imdb"])
    expect(screen.getByText("A Show")).toBeTruthy()
    const overview = document.querySelector("[data-media-overview]")!
    expect(overview.className).toContain("line-clamp-3")
    fireEvent.click(document.querySelector("[data-media-more]")!)
    expect(overview.className).not.toContain("line-clamp-3")
  })

  it("without a backdrop: plain card, no blur layer", () => {
    render(() => <MediaHeaderCard item={item({ backdrop_url: "" })} />)
    expect(document.querySelector("[data-media-backdrop]")).toBeNull()
    expect(
      document
        .querySelector("[data-media-header]")!
        .hasAttribute("data-has-backdrop"),
    ).toBe(false)
    expect(document.querySelector("[data-media-poster] img")).not.toBeNull()
  })

  it("without a poster: a placeholder instead of an image", () => {
    render(() => <MediaHeaderCard item={item({ poster_url: "" })} />)
    expect(document.querySelector("[data-media-poster] img")).toBeNull()
    expect(document.querySelector("[data-media-poster-empty]")).not.toBeNull()
  })

  it("a collection shows only the title card, no poster", () => {
    render(() => <MediaHeaderCard item={item({ kind: "collection" })} />)
    expect(document.querySelector("[data-media-poster]")).toBeNull()
    expect(screen.getByText("A Show")).toBeTruthy()
  })

  it("the edit button asks for the editor on this folder (admin)", () => {
    setMediaFor("/lib/Show", {
      item: item(),
      children: [],
      episodes: [],
    } as MediaFs)
    render(() => <MediaHeaderCard item={item()} />)
    fireEvent.click(document.querySelector("[data-media-edit]")!)
    expect(editorPath()).toBe("/lib/Show")
    openMediaEditor("") // reset is not needed: afterEach clears the media data only
  })
})
