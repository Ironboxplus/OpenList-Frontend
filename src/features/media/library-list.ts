// The data behind the library page: pages of scraped items fetched one after
// another. No DOM and no router here; the page decides the filter and when to
// load, this keeps the list, the total and the request state.
import { batch, createSignal } from "solid-js"
import type { ApiResult } from "~/platform/api/client"
import type { LibraryKind, LibraryPage, MediaCard } from "./types"

export const LIBRARY_KINDS: readonly LibraryKind[] = [
  "movie",
  "tv",
  "anime",
  "collection",
]
export type LibraryFilter = "all" | LibraryKind
export const LIBRARY_FILTERS: readonly LibraryFilter[] = [
  "all",
  ...LIBRARY_KINDS,
]

export const isLibraryFilter = (v: unknown): v is LibraryFilter =>
  typeof v === "string" && (LIBRARY_FILTERS as readonly string[]).includes(v)

export const LIBRARY_PER_PAGE = 60

export type FetchLibraryPage = (args: {
  kind?: LibraryKind
  page: number
  perPage: number
}) => Promise<ApiResult<LibraryPage>>

export const createLibraryList = (fetchPage: FetchLibraryPage) => {
  const [items, setItems] = createSignal<MediaCard[]>([])
  const [total, setTotal] = createSignal(0)
  const [loading, setLoading] = createSignal(false)
  const [error, setError] = createSignal<string>()
  const [loaded, setLoaded] = createSignal(false)
  let filter: LibraryFilter = "all"
  let page = 0
  // A newer request (another filter) makes an older answer irrelevant.
  let generation = 0

  const run = async (next: number, replace: boolean) => {
    const mine = ++generation
    batch(() => {
      setLoading(true)
      setError(undefined)
    })
    const out = await fetchPage({
      kind: filter === "all" ? undefined : filter,
      page: next,
      perPage: LIBRARY_PER_PAGE,
    })
    if (mine !== generation) return
    batch(() => {
      setLoading(false)
      if (!out.ok) {
        setError(out.error.message)
        return
      }
      page = next
      setItems((cur) =>
        replace ? out.data.content : [...cur, ...out.data.content],
      )
      setTotal(out.data.total)
      setLoaded(true)
    })
  }

  return {
    items,
    total,
    loading,
    error,
    /** True once a page has arrived for the current filter. */
    loaded,
    hasMore: () => items().length < total(),
    /** Start over with this filter. */
    load: (next: LibraryFilter) => {
      filter = next
      page = 0
      batch(() => {
        setItems([])
        setTotal(0)
        setLoaded(false)
      })
      return run(1, true)
    },
    loadMore: () => (loading() ? Promise.resolve() : run(page + 1, false)),
    /** Try the failed request again. */
    retry: () => (loaded() ? run(page + 1, false) : run(1, true)),
  }
}

export type LibraryList = ReturnType<typeof createLibraryList>
