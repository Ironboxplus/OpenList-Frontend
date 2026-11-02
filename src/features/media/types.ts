// What the file browser's media view works with. adapt.ts builds it from the
// public media API (GET /api/fs/media/list and /by_path, types/media.ts); the
// admin endpoints (/api/admin/media/curate/*) take and answer these shapes. The
// source of truth is server/handles/media*.go in the backend.

export type MediaKind = "movie" | "tv" | "anime" | "collection" | "ignore"

export interface MediaCard {
  path: string
  kind: MediaKind
  title: string
  year: number
  ratings: Record<string, number | string>
  poster_url: string
  /** Collections: up to 4 thumb URLs of the members, for the mosaic. */
  child_posters?: string[]
}

export interface MediaCandidate {
  provider: string
  id: string
  title: string
  year: number
  poster_url: string
  score: number
}

export interface MediaItem extends MediaCard {
  original_title: string
  external_ids: Record<string, string>
  genres: string[]
  overview: string
  backdrop_url: string
  source: string
  confidence: number
  locked: boolean
  candidates?: MediaCandidate[]
  scraped_at?: string | null
}

export interface MediaEpisode {
  file_name: string
  season: number
  episode: number
  title: string
  overview: string
}

export interface MediaFs {
  item: MediaItem | null
  children: MediaCard[]
  episodes: MediaEpisode[]
  /**
   * The video libraries (scan paths) the user can see, as paths in the file
   * browser's terms. A folder in this list is a library.
   */
  libraries: string[]
}

/** One result of GET /api/admin/media/search. */
export interface SearchCandidate {
  provider: string
  id: string
  kind?: string
  title: string
  original_title?: string
  year: number
  poster_url: string
  score: number
}
