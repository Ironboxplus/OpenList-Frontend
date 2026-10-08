import { fireEvent, render, waitFor } from "@solidjs/testing-library"
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
  mediaClient: { get: vi.fn(), invalidate: vi.fn() },
}))

import * as client from "../client"
import { EditorBody } from "../MediaEditor"
import { setMediaFor } from "../state"

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

describe("EditorBody: search, pick, apply", () => {
  beforeEach(() => {
    setMediaFor("/lib/Show", {
      item: item({ candidates: [] }),
      children: [],
      episodes: [],
    } as MediaFs)
  })

  it("searches the chosen source, lists results and applies one with the lock", async () => {
    vi.mocked(client.searchMedia).mockResolvedValue({
      ok: true,
      data: [
        {
          provider: "tmdb",
          id: "tv/1",
          title: "Hit",
          year: 2020,
          poster_url: "",
          score: 0.9,
        },
        {
          provider: "tmdb",
          id: "tv/2",
          title: "Other",
          year: 2019,
          poster_url: "",
          score: 0.5,
        },
      ],
    })
    vi.mocked(client.scrapeMedia).mockResolvedValue({ ok: true, data: {} })
    render(() => <EditorBody path="/lib/Show" />)
    const q = document.querySelector("[data-editor-query]") as HTMLInputElement
    fireEvent.input(q, { target: { value: "hit show" } })
    fireEvent.click(document.querySelector("[data-editor-search]")!)
    await waitFor(() =>
      expect(
        document.querySelector('[data-candidate="tmdb:tv/1"]'),
      ).not.toBeNull(),
    )
    expect(client.searchMedia).toHaveBeenCalledWith("tmdb", "hit show", "tv")
    fireEvent.click(
      document.querySelector('[data-candidate="tmdb:tv/1"] [data-apply]')!,
    )
    await waitFor(() => expect(client.scrapeMedia).toHaveBeenCalled())
    expect(client.scrapeMedia).toHaveBeenCalledWith(
      "/lib/Show",
      "tmdb",
      "tv/1",
      false,
    )
  })

  it("an unreachable provider shows the CLI command to copy", async () => {
    vi.mocked(client.searchMedia).mockResolvedValue({
      ok: false,
      message: "network: dial tcp: i/o timeout",
      category: "network",
    })
    render(() => <EditorBody path="/lib/Show" />)
    fireEvent.click(document.querySelector("[data-editor-search]")!)
    await waitFor(() =>
      expect(document.querySelector("[data-editor-network]")).not.toBeNull(),
    )
    expect(
      document.querySelector("[data-editor-network] code")!.textContent,
    ).toBe(
      'openlist media scrape --path "/lib/Show" --provider tmdb --env media.env',
    )
  })

  it("lists the item's own candidates first", () => {
    setMediaFor("/lib/Show", {
      item: item({
        candidates: [
          {
            provider: "bgm",
            id: "265",
            title: "Cand",
            year: 2001,
            poster_url: "",
            score: 0.7,
          },
        ],
      }),
      children: [],
      episodes: [],
    } as MediaFs)
    render(() => <EditorBody path="/lib/Show" />)
    expect(
      document.querySelector(
        "[data-editor-suggested] [data-candidate='bgm:265']",
      ),
    ).not.toBeNull()
  })
})
