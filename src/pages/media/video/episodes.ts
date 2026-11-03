import { parseEpisodes } from "~/types"
import type { EpisodeInfo, MediaEpisodeView, MediaItem } from "~/types"
import { episodeLabel } from "~/features/media/logic"

/**
 * One row of the episode list. `index` and `file_name` are what the player and
 * the watch progress key on (EpisodeInfo); the rest comes from the detail's
 * episode_list when the backend has it.
 */
export interface EpisodeRow extends EpisodeInfo {
  season?: number
  episode?: number
  overview?: string
  still_url?: string
  /** Other files of this same episode (a second release folder), main row first. */
  versions?: EpisodeRow[]
}

/**
 * A series whose episodes exist in several release folders has, besides the
 * main row of an episode, further rows marked `version` with the same index.
 * They are alternatives of that episode, not more episodes: each is moved into
 * `versions` of the main row before it. A list of version rows only is a film
 * kept in several files and stays as it is (see versions.ts).
 */
const collapseVersions = (rows: EpisodeRow[]): EpisodeRow[] => {
  if (rows.every((r) => r.version)) return rows
  const out: EpisodeRow[] = []
  for (const r of rows) {
    const main = r.version
      ? out.filter((m) => m.index === r.index).pop()
      : undefined
    if (main) main.versions = [...(main.versions ?? []), r]
    else out.push(r)
  }
  return out
}

/**
 * Numbers episodes the way the backend does (model.EpisodeInfos), so that the
 * index of a row is the same one the progress and STRM endpoints expect: the
 * episode number, unless the show spans several seasons or has none, then the
 * position in season/episode order.
 */
const numbered = (list: readonly MediaEpisodeView[]): EpisodeRow[] => {
  const sorted = [...list].sort(
    (a, b) =>
      a.season - b.season ||
      a.episode - b.episode ||
      Number(!!a.version) - Number(!!b.version) ||
      a.file_name.localeCompare(b.file_name),
  )
  const multi = sorted.some((e) => e.season !== sorted[0].season)
  // a version shares the index of the episode before it and takes no position
  // (a film kept in several files lists versions only, each with its own number)
  const film = sorted.every((e) => e.version)
  let pos = 0
  let last = 0
  const indexes = sorted.map((e) => {
    if (e.version && !film && last > 0) return last
    last = multi || e.episode <= 0 ? ++pos : e.episode
    return last
  })
  return sorted.map((e, i) => ({
    file_name: e.file_name,
    index: indexes[i],
    title: e.title,
    season: e.season,
    episode: e.episode,
    overview: e.overview,
    still_url: e.still_url,
    ...(e.version ? { version: true } : {}),
  }))
}

/**
 * The episodes of a show. The item's own `episodes` JSON stays the list that
 * can be played (older scans have nothing else); the detail's episode_list
 * adds season, episode, overview and still to the rows it knows, and stands in
 * when the JSON is empty.
 */
export const episodeRows = (item: MediaItem): EpisodeRow[] =>
  collapseVersions(rawRows(item))

const rawRows = (item: MediaItem): EpisodeRow[] => {
  const list = item.episode_list ?? []
  const base = parseEpisodes(item.episodes)
  if (base.length === 0) return numbered(list)
  const extra = new Map(list.map((e) => [e.file_name, e]))
  return base.map((b) => {
    const e = extra.get(b.file_name)
    return e
      ? {
          ...b,
          season: e.season,
          episode: e.episode,
          overview: e.overview,
          still_url: e.still_url,
          ...(e.version ? { version: true } : {}),
        }
      : b
  })
}

/** "S01E03 · Title" when the backend knows season and episode, else "Episode 3 Title". */
export const episodeText = (
  row: EpisodeRow,
  t: (
    key: "media.video.episode_n_title",
    params: { index: number; title: string },
  ) => string,
): string => {
  const title = (row.title ?? "").trim()
  if (
    row.season !== undefined &&
    row.episode !== undefined &&
    row.episode > 0
  ) {
    const label = episodeLabel(row.season, row.episode)
    return title ? `${label} · ${title}` : label
  }
  if (row.index > 0) {
    return t("media.video.episode_n_title", { index: row.index, title }).trim()
  }
  return title || row.file_name
}
