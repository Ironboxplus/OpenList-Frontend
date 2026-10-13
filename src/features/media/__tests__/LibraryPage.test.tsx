import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { MediaCard } from "../types"

const h = vi.hoisted(() => ({
  to: vi.fn(),
  setParams: vi.fn(),
  admin: { v: false },
  enabled: { v: true },
  library: vi.fn(),
  resetParams: () => {},
}))

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
    useTitle: () => {},
    useRouter: () => ({ to: h.to }),
  }
})
vi.mock("@solidjs/router", async () => {
  const { createStore } = await import("solid-js/store")
  const [params, setStore] = createStore<Record<string, string | undefined>>({})
  h.resetParams = () => setStore({ kind: undefined })
  return {
    useSearchParams: () => [
      params,
      (next: Record<string, string | undefined>, opts?: unknown) => {
        h.setParams(next, opts)
        setStore(next)
      },
    ],
  }
})
vi.mock("~/store", () => ({
  me: () => ({ role: h.admin.v ? 2 : 0 }),
  getSettingBool: () => h.enabled.v,
}))
vi.mock("~/utils/config", () => ({ api: "", base_path: "" }))
vi.mock("../client", () => ({ library: (a: unknown) => h.library(a) }))

import LibraryPage from "../LibraryPage"

const card = (i: number, kind: MediaCard["kind"] = "movie"): MediaCard => ({
  path: `/lib/${i}`,
  kind,
  title: `Title ${i}`,
  year: 2000 + i,
  ratings: {},
  poster_url: "",
})
const page = (content: MediaCard[], total = content.length) =>
  Promise.resolve({ ok: true, data: { content, total } })

beforeEach(() => {
  h.to.mockClear()
  h.setParams.mockClear()
  h.library.mockReset()
  h.admin.v = false
  h.enabled.v = true
  h.resetParams()
})

describe("LibraryPage", () => {
  it("asks for the first page of everything and draws a card per item", async () => {
    h.library.mockReturnValue(page([card(1), card(2)]))
    render(() => <LibraryPage />)
    expect(await screen.findAllByTestId("library-card")).toHaveLength(2)
    expect(h.library).toHaveBeenCalledWith({
      kind: undefined,
      page: 1,
      perPage: 60,
    })
    expect(screen.queryByTestId("library-more")).toBeNull()
  })

  it("writes the chosen kind into the URL and reloads with it", async () => {
    h.library.mockReturnValue(page([card(1)]))
    render(() => <LibraryPage />)
    await screen.findAllByTestId("library-card")
    fireEvent.click(document.querySelector("[data-chip=tv]")!)
    expect(h.setParams).toHaveBeenLastCalledWith(
      { kind: "tv" },
      { replace: true },
    )
    await waitFor(() =>
      expect(h.library).toHaveBeenLastCalledWith({
        kind: "tv",
        page: 1,
        perPage: 60,
      }),
    )
    fireEvent.click(document.querySelector("[data-chip=all]")!)
    expect(h.setParams).toHaveBeenLastCalledWith(
      { kind: undefined },
      { replace: true },
    )
  })

  it("offers exactly all, movie, tv, anime and collection", async () => {
    h.library.mockReturnValue(page([card(1)]))
    render(() => <LibraryPage />)
    await screen.findAllByTestId("library-card")
    expect(
      [...document.querySelectorAll("[data-chip]")].map((c) =>
        c.getAttribute("data-chip"),
      ),
    ).toEqual(["all", "movie", "tv", "anime", "collection"])
  })

  it("loads more and hides the button when everything is shown", async () => {
    h.library
      .mockReturnValueOnce(page([card(1), card(2)], 3))
      .mockReturnValueOnce(page([card(3)], 3))
    render(() => <LibraryPage />)
    await screen.findAllByTestId("library-card")
    fireEvent.click(screen.getByTestId("library-more"))
    await waitFor(() =>
      expect(screen.getAllByTestId("library-card")).toHaveLength(3),
    )
    expect(h.library).toHaveBeenLastCalledWith({
      kind: undefined,
      page: 2,
      perPage: 60,
    })
    expect(screen.queryByTestId("library-more")).toBeNull()
  })

  it("goes to the item's path when a card is clicked", async () => {
    h.library.mockReturnValue(page([card(7)]))
    render(() => <LibraryPage />)
    fireEvent.click(await screen.findByTestId("library-card"))
    expect(h.to).toHaveBeenCalledWith("/lib/7")
  })

  it("says so when nothing is scraped; only an admin gets the way forward", async () => {
    h.library.mockReturnValue(page([]))
    const { unmount } = render(() => <LibraryPage />)
    await waitFor(() =>
      expect(document.querySelector("[data-state=empty]")).toBeTruthy(),
    )
    expect(document.body.textContent).toContain("No scraped media yet.")
    expect(screen.queryByText("Go to Files")).toBeNull()
    unmount()
    h.admin.v = true
    render(() => <LibraryPage />)
    fireEvent.click(await screen.findByText("Go to Files"))
    expect(h.to).toHaveBeenCalledWith("/")
  })

  it("shows the failure with a retry that asks again", async () => {
    h.library
      .mockReturnValueOnce(
        Promise.resolve({ ok: false, error: { message: "nope" } }),
      )
      .mockReturnValueOnce(page([card(1)]))
    render(() => <LibraryPage />)
    await waitFor(() =>
      expect(document.querySelector("[data-state=error]")).toBeTruthy(),
    )
    expect(document.body.textContent).toContain("nope")
    fireEvent.click(document.querySelector("[data-state=error] button")!)
    expect(await screen.findAllByTestId("library-card")).toHaveLength(1)
  })

  it("explains instead of fetching when media is switched off", () => {
    h.enabled.v = false
    render(() => <LibraryPage />)
    expect(screen.getByTestId("media-disabled")).toBeTruthy()
    expect(h.library).not.toHaveBeenCalled()
  })
})
