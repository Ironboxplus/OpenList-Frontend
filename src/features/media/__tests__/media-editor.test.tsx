import { fireEvent, render, waitFor } from "@solidjs/testing-library"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { EditorItem } from "../editor-item"

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
  uploadMediaImage: vi.fn(),
  mediaClient: { get: vi.fn(), invalidate: vi.fn() },
}))

import * as client from "../client"
import { EditorBody } from "../MediaEditor"

const item = (over: Partial<EditorItem> = {}): EditorItem => ({
  path: "/lib/Show",
  kind: "tv",
  title: "A Show",
  original_title: "原名",
  year: 2021,
  overview: "plot",
  locked: false,
  confidence: 1,
  candidates: [],
  cover: "",
  ...over,
})

const renderEditor = (it: EditorItem | undefined, onChanged = vi.fn()) => {
  const onClose = vi.fn()
  render(() => (
    <EditorBody
      path="/lib/Show"
      item={it}
      onChanged={onChanged}
      onClose={onClose}
    />
  ))
  return { onChanged, onClose }
}

afterEach(() => {
  vi.clearAllMocks()
})

describe("EditorBody: search, pick, apply", () => {
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
    const { onChanged, onClose } = renderEditor(item())
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
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(onChanged).toHaveBeenCalled()
  })

  it("an unreachable provider shows the CLI command to copy", async () => {
    vi.mocked(client.searchMedia).mockResolvedValue({
      ok: false,
      message: "network: dial tcp: i/o timeout",
      category: "network",
    })
    renderEditor(item())
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
    renderEditor(
      item({
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
    )
    expect(
      document.querySelector(
        "[data-editor-suggested] [data-candidate='bgm:265']",
      ),
    ).not.toBeNull()
  })

  it("does not offer the library kind, which the backend rejects", () => {
    renderEditor(item())
    const options = [
      ...document.querySelectorAll<HTMLOptionElement>(
        "[data-editor-kind] option",
      ),
    ].map((o) => o.value)
    expect(options).toEqual(["movie", "tv", "anime", "collection", "ignore"])
  })

  it("a lock toggle sends nothing but the lock", async () => {
    vi.mocked(client.setMediaMeta).mockResolvedValue({ ok: true, data: {} })
    const { onChanged } = renderEditor(item({ locked: false }))
    fireEvent.click(document.querySelector("[data-editor-lock]")!)
    await waitFor(() => expect(client.setMediaMeta).toHaveBeenCalled())
    expect(client.setMediaMeta).toHaveBeenCalledWith({
      path: "/lib/Show",
      locked: true,
    })
    expect(onChanged).toHaveBeenCalled()
  })
})

describe("EditorBody: details", () => {
  it("saves only the fields that changed", async () => {
    vi.mocked(client.setMediaMeta).mockResolvedValue({ ok: true, data: {} })
    const { onChanged } = renderEditor(item())
    fireEvent.input(document.querySelector("[data-editor-title]")!, {
      target: { value: "Renamed" },
    })
    fireEvent.click(document.querySelector("[data-editor-save-details]")!)
    await waitFor(() => expect(client.setMediaMeta).toHaveBeenCalled())
    expect(client.setMediaMeta).toHaveBeenCalledWith({
      path: "/lib/Show",
      title: "Renamed",
    })
    expect(onChanged).toHaveBeenCalled()
  })

  it("stores a poster url first and references what the server answers", async () => {
    vi.mocked(client.uploadMediaImage).mockResolvedValue({
      ok: true,
      data: { cover: "thumb:/media/x.jpg" },
    })
    vi.mocked(client.setMediaMeta).mockResolvedValue({ ok: true, data: {} })
    renderEditor(item())
    fireEvent.input(
      document.querySelector('[data-editor-url="poster"]') as HTMLInputElement,
      { target: { value: "https://img.example/p.jpg" } },
    )
    fireEvent.click(document.querySelector("[data-editor-save-details]")!)
    await waitFor(() => expect(client.setMediaMeta).toHaveBeenCalled())
    expect(client.uploadMediaImage).toHaveBeenCalledWith(
      "/lib/Show",
      "poster",
      "https://img.example/p.jpg",
    )
    expect(client.setMediaMeta).toHaveBeenCalledWith({
      path: "/lib/Show",
      cover: "thumb:/media/x.jpg",
    })
  })

  it("does not touch the work when the image could not be stored", async () => {
    vi.mocked(client.uploadMediaImage).mockResolvedValue({
      ok: false,
      message: "download failed",
    })
    renderEditor(item())
    fireEvent.input(
      document.querySelector('[data-editor-url="poster"]') as HTMLInputElement,
      { target: { value: "https://img.example/p.jpg" } },
    )
    fireEvent.click(document.querySelector("[data-editor-save-details]")!)
    await waitFor(() =>
      expect(document.querySelector("[data-editor-status]")).not.toBeNull(),
    )
    expect(client.setMediaMeta).not.toHaveBeenCalled()
  })

  it("has no details form for a path without media info", () => {
    renderEditor(undefined)
    expect(document.querySelector("[data-editor-details]")).toBeNull()
  })
})
