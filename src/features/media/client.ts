import { api, apiGet, apiPost } from "~/platform/api/client"
import { password } from "~/store"
import { createMediaClient } from "./logic"
import type {
  LibraryKind,
  LibraryPage,
  MediaCandidate,
  MediaFs,
  MediaKind,
  SearchCandidate,
} from "./types"

/** The one client of the session: LRU of 50 directories, off after a 404. */
export const mediaClient = createMediaClient(async (path) => {
  const out = await apiPost<MediaFs>("/fs/media", {
    body: { path, password: password() },
  })
  if (!out.ok) return { ok: false, status: out.error.httpStatus }
  const d = out.data
  return {
    ok: true,
    data: {
      item: d?.item ?? null,
      children: d?.children ?? [],
      episodes: d?.episodes ?? [],
    },
  }
})

/** One page of the scraped items the signed-in user may see; no kind lists all. */
export const library = (args: {
  kind?: LibraryKind
  page: number
  perPage: number
}) =>
  apiGet<LibraryPage>("/media/library", {
    params: { kind: args.kind, page: args.page, per_page: args.perPage },
  })

export interface EditorOutcome<T> {
  ok: boolean
  data?: T
  message?: string
  /** "network" when the server could not reach the data source. */
  category?: string
}

const wrap = async <T>(
  call: ReturnType<typeof api<T>>,
): Promise<EditorOutcome<T>> => {
  const out = await call
  if (out.ok) return { ok: true, data: out.data }
  return {
    ok: false,
    message: out.error.message,
    // The server reports an unreachable provider as "network: ...".
    category: /^network\b/i.test(out.error.message)
      ? "network"
      : out.error.category,
  }
}

export const searchMedia = (
  provider: "tmdb" | "bgm",
  q: string,
  kind?: MediaKind,
) =>
  wrap<SearchCandidate[]>(
    apiGet("/admin/media/search", {
      params: { provider, q, ...(kind && kind !== "ignore" ? { kind } : {}) },
    }),
  )

export const scrapeMedia = (
  path: string,
  provider: string,
  id: string,
  lock: boolean,
) =>
  wrap<unknown>(
    apiPost("/admin/media/scrape", { body: { path, provider, id, lock } }),
  )

export const deleteMedia = (path: string) =>
  wrap<{ deleted: number }>(apiPost("/admin/media/delete", { body: { path } }))

export const setMediaMeta = (body: {
  path: string
  kind?: MediaKind
  locked?: boolean
}) => wrap<unknown>(apiPost("/admin/media/set", { body }))

export type { MediaCandidate }
