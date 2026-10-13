import { describe, expect, it, vi } from "vitest"
import type { ApiResult } from "~/platform/api/client"
import {
  createLibraryList,
  isLibraryFilter,
  LIBRARY_PER_PAGE,
} from "../library-list"
import type { LibraryPage, MediaCard } from "../types"

const card = (i: number): MediaCard => ({
  path: `/m/${i}`,
  kind: "movie",
  title: `T${i}`,
  year: 2000 + i,
  ratings: {},
  poster_url: "",
})
const ok = (content: MediaCard[], total: number): ApiResult<LibraryPage> => ({
  ok: true,
  data: { content, total },
})
const fail = (message: string): ApiResult<LibraryPage> => ({
  ok: false,
  error: { message } as never,
})

describe("isLibraryFilter", () => {
  it("accepts all and the four kinds only", () => {
    for (const k of ["all", "movie", "tv", "anime", "collection"])
      expect(isLibraryFilter(k)).toBe(true)
    for (const k of ["ignore", "library", "music", "", undefined])
      expect(isLibraryFilter(k)).toBe(false)
  })
})

describe("createLibraryList", () => {
  it("asks for page 1 with no kind for all, and the kind otherwise", async () => {
    const fetchPage = vi.fn(async () => ok([card(1)], 1))
    const list = createLibraryList(fetchPage)
    await list.load("all")
    expect(fetchPage).toHaveBeenLastCalledWith({
      kind: undefined,
      page: 1,
      perPage: LIBRARY_PER_PAGE,
    })
    await list.load("tv")
    expect(fetchPage).toHaveBeenLastCalledWith({
      kind: "tv",
      page: 1,
      perPage: LIBRARY_PER_PAGE,
    })
  })

  it("loads more as the next page and appends", async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce(ok([card(1), card(2)], 3))
      .mockResolvedValueOnce(ok([card(3)], 3))
    const list = createLibraryList(fetchPage)
    await list.load("all")
    expect(list.hasMore()).toBe(true)
    await list.loadMore()
    expect(fetchPage).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 2 }),
    )
    expect(list.items().map((c) => c.path)).toEqual(["/m/1", "/m/2", "/m/3"])
    expect(list.hasMore()).toBe(false)
  })

  it("keeps what is shown when loading more fails, and retries the same page", async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce(ok([card(1)], 2))
      .mockResolvedValueOnce(fail("boom"))
      .mockResolvedValueOnce(ok([card(2)], 2))
    const list = createLibraryList(fetchPage)
    await list.load("all")
    await list.loadMore()
    expect(list.error()).toBe("boom")
    expect(list.items()).toHaveLength(1)
    await list.retry()
    expect(fetchPage).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 2 }),
    )
    expect(list.error()).toBeUndefined()
    expect(list.items()).toHaveLength(2)
  })

  it("retries the first page when it never loaded", async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce(fail("down"))
      .mockResolvedValueOnce(ok([card(1)], 1))
    const list = createLibraryList(fetchPage)
    await list.load("all")
    expect(list.loaded()).toBe(false)
    await list.retry()
    expect(fetchPage).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 1 }),
    )
    expect(list.loaded()).toBe(true)
  })

  it("drops the answer of a filter that was replaced meanwhile", async () => {
    let release!: (r: ApiResult<LibraryPage>) => void
    const fetchPage = vi
      .fn()
      .mockReturnValueOnce(new Promise((res) => (release = res)))
      .mockResolvedValueOnce(ok([card(9)], 1))
    const list = createLibraryList(fetchPage)
    const first = list.load("movie")
    await list.load("tv")
    release(ok([card(1), card(2)], 2))
    await first
    expect(list.items().map((c) => c.path)).toEqual(["/m/9"])
  })
})
