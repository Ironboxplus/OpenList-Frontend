import { parseEpisodes } from "~/types"
import type { MediaItem } from "~/types"
import { episodeRows, type EpisodeRow } from "./episodes"

/**
 * A film kept in several files (releases, re-encodes) comes from the backend
 * as `versions` on the item and `version: true` on the entries of its episode
 * list; the entries play like episodes (same index, same progress key) but are
 * choices, not a series.
 */
const allVersions = (list: readonly { version?: boolean }[]): number =>
  list.length > 1 && list.every((e) => e.version) ? list.length : 0

export const versionCount = (item: MediaItem): number => {
  if ((item.versions ?? 0) > 1) return item.versions!
  // A film lists its files and nothing else. A series whose episodes exist in
  // several release folders also has version entries, next to the main ones.
  return (
    allVersions(item.episode_list ?? []) ||
    allVersions(parseEpisodes(item.episodes))
  )
}

export const isVersionSet = (item: MediaItem): boolean => versionCount(item) > 0

/** The version entries, default (first) first; empty for a series. */
export const versionRows = (item: MediaItem): EpisodeRow[] =>
  isVersionSet(item) ? episodeRows(item).filter((r) => r.version) : []

const baseName = (name: string): string =>
  name.replace(/\.[A-Za-z0-9]{2,4}$/, "")

const tokensOf = (name: string): string[] =>
  baseName(name)
    .split(/[\s._\-\[\]()\/\\]+/)
    .filter(Boolean)

/**
 * Names the versions of one film by what tells them apart: the tokens of each
 * file name (split on dots, spaces, dashes, underscores, brackets and path
 * separators) that are not in every other name, in their order. When exactly
 * one version has nothing of its own it is the plain original and gets
 * `original`. Several with nothing of their own, or a label another version
 * shares, are named by the file name without the extension.
 */
export const versionLabels = (
  names: readonly string[],
  original = "Original",
): string[] => {
  const sets = names.map(
    (n) => new Set(tokensOf(n).map((t) => t.toLowerCase())),
  )
  const labels = names.map((n, i) => {
    const mine = tokensOf(n).filter((t) => {
      const key = t.toLowerCase()
      return sets.some((s, j) => j !== i && !s.has(key))
    })
    return mine.join(" ")
  })
  const bare = labels.filter((l) => !l).length
  return labels.map((l, i) => {
    if (!l) return bare === 1 ? original : baseName(names[i])
    return labels.filter((x) => x === l).length === 1 ? l : baseName(names[i])
  })
}
