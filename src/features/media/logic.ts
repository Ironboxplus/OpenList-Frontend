// Pure decisions of the media view: which rating to show, when the poster wall
// is the default, how episode files map to rows, and the small LRU in front of
// /api/fs/media. Nothing here touches the DOM or the network.
import type { MediaCard, MediaEpisode, MediaFs } from "./types"

// ---- ratings ----

/** Display order of rating sources. */
export const RATING_ORDER = ["douban", "imdb", "rt", "tmdb", "bgm"] as const
export type RatingKey = (typeof RATING_ORDER)[number]

export interface RatingBadge {
  key: RatingKey
  /** Ready to print: "8.7", "94%". */
  text: string
}

const formatRating = (v: unknown): string | undefined => {
  if (typeof v === "number") {
    return Number.isFinite(v) && v > 0 ? v.toFixed(1) : undefined
  }
  if (typeof v === "string") {
    const s = v.trim()
    if (s === "" || s === "N/A" || s === "0" || s === "0.0") return undefined
    return s
  }
  return undefined
}

/** Badges for the detail header: known sources in a fixed order, empty ones dropped. */
export const ratingBadges = (
  ratings: Record<string, unknown> | undefined,
): RatingBadge[] => {
  const out: RatingBadge[] = []
  for (const key of RATING_ORDER) {
    const text = formatRating(ratings?.[key])
    if (text) out.push({ key, text })
  }
  return out
}

/** The single rating on a poster card: Douban first, else IMDb. */
export const cardRating = (
  ratings: Record<string, unknown> | undefined,
): RatingBadge | undefined => {
  for (const key of ["douban", "imdb"] as const) {
    const text = formatRating(ratings?.[key])
    if (text) return { key, text }
  }
  return undefined
}

// ---- poster wall ----

/**
 * The poster wall is the default when at least half of the sub-folders have
 * media info. Files do not count: a folder with a few loose files next to
 * well-scraped shows should still open as a poster wall.
 */
export const preferPoster = (withMedia: number, subdirs: number): boolean =>
  subdirs > 0 && withMedia > 0 && withMedia * 2 >= subdirs

export type ViewChoice = "poster" | "other"
const CHOICE_KEY = "media-view"

export const readChoice = (
  storage: Pick<Storage, "getItem">,
  path: string,
): ViewChoice | undefined => {
  try {
    const rec = JSON.parse(storage.getItem(CHOICE_KEY) ?? "{}")
    const v = rec?.[path]
    return v === "poster" || v === "other" ? v : undefined
  } catch {
    return undefined
  }
}

export const writeChoice = (
  storage: Pick<Storage, "getItem" | "setItem">,
  path: string,
  choice: ViewChoice,
) => {
  try {
    const rec = JSON.parse(storage.getItem(CHOICE_KEY) ?? "{}")
    rec[path] = choice
    storage.setItem(CHOICE_KEY, JSON.stringify(rec))
  } catch {
    // the choice just does not persist
  }
}

/** Name of the entry a child card points at (its last path segment). */
export const baseName = (path: string): string => {
  const p = path.replace(/\/+$/, "")
  return p.slice(p.lastIndexOf("/") + 1)
}

export const cardsByName = (children: readonly MediaCard[]) =>
  new Map(children.map((c) => [baseName(c.path), c]))

// ---- episodes ----

const pad = (n: number) => String(n).padStart(2, "0")

export const episodeLabel = (season: number, episode: number) =>
  `S${pad(season)}E${pad(episode)}`

export interface EpisodeInfo {
  label: string
  title: string
  /** "S01E03 · Title", or just the label when there is no title. */
  text: string
}

/** Episode rows by file name, the key the backend stores them under. */
export const episodeMap = (
  episodes: readonly MediaEpisode[],
): Map<string, EpisodeInfo> => {
  const map = new Map<string, EpisodeInfo>()
  for (const e of episodes) {
    const label = episodeLabel(e.season, e.episode)
    const title = (e.title ?? "").trim()
    map.set(e.file_name, {
      label,
      title,
      text: title ? `${label} · ${title}` : label,
    })
  }
  return map
}

// ---- asset URLs ----

/**
 * `poster_url` is a path on the API host ("/api/media/asset/3?v=thumb&sign=…");
 * <img> needs it absolute when the UI is served from somewhere else.
 */
export const assetSrc = (url: string, apiBase: string): string => {
  if (!url) return ""
  if (/^https?:\/\//i.test(url)) return url
  if (!url.startsWith("/")) return url
  try {
    return new URL(apiBase).origin + url
  } catch {
    return url
  }
}

// ---- cache + client ----

export class Lru<V> {
  private map = new Map<string, V>()
  constructor(private cap: number) {}
  get(key: string): V | undefined {
    const v = this.map.get(key)
    if (v === undefined) return undefined
    this.map.delete(key)
    this.map.set(key, v)
    return v
  }
  set(key: string, v: V) {
    this.map.delete(key)
    this.map.set(key, v)
    while (this.map.size > this.cap) {
      this.map.delete(this.map.keys().next().value as string)
    }
  }
  delete(key: string) {
    this.map.delete(key)
  }
  clear() {
    this.map.clear()
  }
  get size() {
    return this.map.size
  }
  has(key: string) {
    return this.map.has(key)
  }
}

export type FetchOutcome =
  | { ok: true; data: MediaFs }
  | { ok: false; status?: number }

export const normPath = (p: string): string => {
  const t = p.replace(/\/+$/, "")
  return t === "" ? "/" : t
}

/**
 * One request per directory visit, remembered for the next visit. A 404 means
 * the backend has no media API at all: the client switches itself off for the
 * rest of the session and every later call answers without a request.
 */
export const createMediaClient = (
  fetchFs: (path: string) => Promise<FetchOutcome>,
  capacity = 50,
) => {
  const cache = new Lru<MediaFs>(capacity)
  const inflight = new Map<string, Promise<MediaFs | undefined>>()
  let unavailable = false

  const get = (path: string): Promise<MediaFs | undefined> => {
    const key = normPath(path)
    if (unavailable) return Promise.resolve(undefined)
    const hit = cache.get(key)
    if (hit) return Promise.resolve(hit)
    const pending = inflight.get(key)
    if (pending) return pending
    const p = fetchFs(key)
      .then((out) => {
        if (out.ok) {
          cache.set(key, out.data)
          return out.data
        }
        if (out.status === 404) unavailable = true
        return undefined
      })
      .catch(() => undefined)
      .finally(() => inflight.delete(key))
    inflight.set(key, p)
    return p
  }

  return {
    get,
    /** Forget one directory (it was refreshed or edited), or everything. */
    invalidate: (path?: string) =>
      path === undefined ? cache.clear() : cache.delete(normPath(path)),
    isUnavailable: () => unavailable,
    size: () => cache.size,
  }
}
