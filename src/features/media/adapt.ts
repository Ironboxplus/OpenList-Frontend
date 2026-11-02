// The public media API's items (types/media.ts MediaItem, the shape of
// /api/fs/media/list and /by_path) as the file browser's cards and header item
// (types.ts). Pure.
import { getMediaName, parseCandidates, parseExternalIds } from "~/types"
import type { MediaItem as ApiItem, MediaEpisodeView } from "~/types"
import { resolveMediaCover } from "~/utils/media_cover"
import type { MediaCard, MediaEpisode, MediaItem, MediaKind } from "./types"

const KINDS: readonly string[] = ["movie", "tv", "anime", "collection"]

/** video_type as a card kind; a work with none stored is a movie. */
const kindOf = (v: ApiItem): MediaKind =>
  (KINDS.includes(v.video_type) ? v.video_type : "movie") as MediaKind

const yearOf = (v: ApiItem): number =>
  Number((v.release_date ?? "").slice(0, 4)) || 0

export const cardOf = (v: ApiItem): MediaCard => ({
  path: v.path ?? "",
  kind: kindOf(v),
  title: getMediaName(v),
  year: yearOf(v),
  ratings: v.ratings ?? {},
  poster_url: resolveMediaCover(v),
  ...(v.child_posters ? { child_posters: v.child_posters } : {}),
})

export const itemOf = (v: ApiItem): MediaItem => ({
  ...cardOf(v),
  original_title: v.original_title ?? "",
  external_ids: parseExternalIds(v),
  genres: (v.genre ?? "").split(",").filter(Boolean),
  overview: v.plot || v.description || "",
  backdrop_url: v.backdrop_url ?? "",
  source: v.source ?? "",
  confidence: v.confidence ?? 1,
  locked: !!v.locked,
  candidates: parseCandidates(v),
  scraped_at: v.scraped_at,
})

export const episodesOf = (
  list: readonly MediaEpisodeView[] | undefined,
): MediaEpisode[] =>
  (list ?? []).map((e) => ({
    file_name: e.file_name,
    season: e.season,
    episode: e.episode,
    title: e.title,
    overview: e.overview,
  }))

/**
 * Scan paths are stored as absolute paths; the file browser works relative to
 * the user's base path. A path outside the base path is not the user's.
 */
export const relativeTo = (
  absolute: string,
  base: string | undefined,
): string | undefined => {
  const b = (base ?? "/").replace(/\/+$/, "")
  const a = absolute.replace(/\/+$/, "") || "/"
  if (b === "") return a
  if (a === b) return "/"
  return a.startsWith(b + "/") ? a.slice(b.length) : undefined
}

/** The reverse: a path the browser shows, as the server stores it. */
export const absoluteOf = (path: string, base: string | undefined): string => {
  const b = (base ?? "/").replace(/\/+$/, "")
  const p = path.replace(/\/+$/, "")
  return (b + (p.startsWith("/") ? p : "/" + p)).replace(/\/+$/, "") || "/"
}
