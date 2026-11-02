import {
  api,
  apiGet,
  apiPost,
  legacyCode,
  type ApiResult,
} from "~/platform/api/client"
import { me } from "~/store"
import type { MediaItem as ApiItem, MediaScanPath } from "~/types"
import { absoluteOf, cardOf, episodesOf, itemOf, relativeTo } from "./adapt"
import { baseName, createMediaClient, normPath } from "./logic"
import type { MediaCandidate, MediaKind, SearchCandidate } from "./types"

/** Children of a directory, all pages of it (a library holds hundreds of works). */
const listChildren = async (path: string): Promise<ApiResult<ApiItem[]>> => {
  const PAGE = 200
  const MAX_PAGES = 10
  const all: ApiItem[] = []
  for (let page = 1; page <= MAX_PAGES; page++) {
    const out = await apiGet<{ content: ApiItem[] | null; total: number }>(
      "/fs/media/list",
      { params: { media_type: "video", path, page, page_size: PAGE } },
    )
    if (!out.ok) return out
    all.push(...(out.data.content ?? []))
    if (all.length >= out.data.total || !out.data.content?.length) break
  }
  return { ok: true, data: all }
}

/** The work at `path` with its episodes; a miss (404) is "no item", not a failure. */
const itemAt = async (path: string): Promise<ApiResult<ApiItem | null>> => {
  const out = await apiGet<ApiItem>("/fs/media/by_path", { params: { path } })
  if (out.ok) return out
  return legacyCode(out.error) === 404 ? { ok: true, data: null } : out
}

/** The video libraries the user can see, in the file browser's paths. */
const visibleLibraries = async (): Promise<string[]> => {
  const out = await apiGet<MediaScanPath[]>("/fs/media/scan_paths", {
    params: { media_type: "video" },
  })
  if (!out.ok) return []
  const base = me()?.base_path
  return (out.data ?? [])
    .map((p) => relativeTo(p.path, base))
    .filter((p): p is string => p !== undefined)
}

/**
 * The one client of the session: LRU of 50 directories, off after a 404 of the
 * listing (the backend has no media library, or it is switched off).
 */
export const mediaClient = createMediaClient(async (path) => {
  const [list, own, libraries] = await Promise.all([
    listChildren(path),
    itemAt(path),
    visibleLibraries(),
  ])
  if (!list.ok) return { ok: false, status: legacyCode(list.error) }
  if (!own.ok) return { ok: false, status: legacyCode(own.error) }
  return {
    ok: true,
    data: {
      item: own.data ? itemOf(own.data) : null,
      children: list.data.map(cardOf),
      episodes: episodesOf(own.data?.episode_list),
      libraries,
    },
  }
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

/**
 * A video library is a video scan path. Marking a folder creates one at it (the
 * scan itself is started from the media settings); unmarking deletes it.
 * `path_merge` is what makes the folders directly under a library its works
 * (one item per folder, with its episodes, kind identified); without it the scan
 * stores one item per video file and the poster wall of the library is empty.
 */
export const markLibrary = (path: string) =>
  wrap<MediaScanPath>(
    apiPost("/admin/media/scan_paths/create", {
      body: {
        media_type: "video",
        name: baseName(path) || path,
        path: absoluteOf(path, me()?.base_path),
        path_merge: true,
        enable_scrape: true,
      },
    }),
  )

export const unmarkLibrary = async (
  path: string,
): Promise<EditorOutcome<unknown>> => {
  const list = await wrap<MediaScanPath[]>(
    apiGet("/admin/media/scan_paths", { params: { media_type: "video" } }),
  )
  if (!list.ok) return list
  const abs = absoluteOf(path, me()?.base_path)
  const found = (list.data ?? []).find((p) => normPath(p.path) === abs)
  if (!found?.id) return { ok: false, message: "not a library" }
  return wrap<unknown>(
    apiPost("/admin/media/scan_paths/delete", { params: { id: found.id } }),
  )
}

export type { MediaCandidate }
