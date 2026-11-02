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
    apiGet("/admin/media/curate/search", {
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
    apiPost("/admin/media/curate/scrape", {
      body: { path, provider, id, lock },
    }),
  )

export const deleteMedia = (path: string) =>
  wrap<{ deleted: number }>(
    apiPost("/admin/media/curate/delete", { body: { path } }),
  )

/**
 * Body of POST /api/admin/media/curate/set (backend model.MediaSetReq): only the
 * fields given are written, so a lock toggle sends nothing but `locked`.
 */
export interface MediaSetBody {
  path: string
  kind?: MediaKind
  title?: string
  original_title?: string
  year?: number
  external_ids?: Record<string, string>
  genres?: string[]
  overview?: string
  cover?: string
  backdrop?: string
  locked?: boolean
}

export const setMediaMeta = (body: MediaSetBody) =>
  wrap<unknown>(apiPost("/admin/media/curate/set", { body }))

/**
 * Stores a poster or backdrop for the work at `path` (a file the admin picked,
 * or a url the server downloads) and answers with the cover reference. It does
 * not touch the work: pass the reference to setMediaMeta as `cover`/`backdrop`.
 */
export const uploadMediaImage = (
  path: string,
  role: "poster" | "backdrop",
  source: File | string,
) =>
  wrap<{ cover: string }>(
    apiPost("/admin/media/curate/image", {
      params: { path, role },
      body: (() => {
        if (typeof source === "string") return { url: source }
        const form = new FormData()
        form.append("file", source)
        return form
      })(),
    }),
  )

export type { MediaCandidate }
