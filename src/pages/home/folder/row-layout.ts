/**
 * Decides whether a directory should render as media rows ({@link MediaListItem})
 * instead of the table layout ({@link ListItem}).
 *
 * Two layers, deliberately:
 *
 *  1. `provider` gates it. Only drivers known to supply media metadata are
 *     candidates, so this can never change how other storages look.
 *  2. The directory's own contents decide. A 115 folder full of PDFs has no
 *     thumbnails and no durations — media rows would render as "title + size"
 *     across two lines, i.e. strictly worse than the table. So the layout is
 *     chosen from what is actually present, not from the driver name alone.
 *
 * Layer 2 is why this isn't `if (provider === "115 Open")`. It also means new
 * drivers only need adding to the allowlist to benefit, and that 115's older
 * uploads (which carry no `play_long`/`def`) degrade on their own.
 *
 * Named for what it decides (row layout), not for where the data comes from —
 * REFACTOR_PLAN §7.13. Pure and framework-free so the decision is unit-testable
 * without a DOM.
 */

import { readExtra } from "./extra-meta"

/**
 * Drivers whose `Obj` implements `model.ObjExtra` with media fields. The string
 * is `storage.Config().Name` as returned in the `provider` field — matching the
 * existing convention in `previews/movi-quality.ts`.
 */
export const MEDIA_PROVIDERS: readonly string[] = ["115 Open"]

export const isMediaProvider = (provider?: string): boolean =>
  !!provider && MEDIA_PROVIDERS.includes(provider)

/** The subset of an object this decision needs — keeps it independent of StoreObj. */
export interface MediaishObj {
  name?: string
  thumb?: string
  extra?: unknown
  is_dir?: boolean
}

/**
 * Whether an entry carries something a media row can actually show beyond what
 * the table already shows: a thumbnail, a duration, or a resolution.
 *
 * A thumbnail counts on its own, and counts for directories too — a folder with
 * cover art is exactly the case media rows exist for.
 */
export const hasMediaInfo = (obj: MediaishObj): boolean => {
  if (obj.thumb) return true
  const e = readExtra(obj.extra)
  return !!e.duration || !!e.resolution
}

/** A name with its final extension removed. `a.b.mkv` → `a.b`, `a` → `a`. */
const stemOf = (name: string): string => {
  const dot = name.lastIndexOf(".")
  return dot > 0 ? name.slice(0, dot) : name
}

/**
 * Partitions entries into media, sidecars-of-media, and everything else.
 *
 * A *sidecar* is a file that exists only to accompany a media file — subtitles,
 * chapter files, `.nfo`. It is recognised structurally, by name: releases name
 * them `<video stem>.sc.ass`, so the sidecar's name begins with the media
 * entry's stem. No extension list is involved, so a format nobody anticipated is
 * handled the same as `.ass`.
 *
 * This matters because sidecars routinely *outnumber* the videos they belong to.
 * Measured on the live library: `/MOV/Anime/少女终末旅行/SPs` holds 22 `.mkv`
 * and 24 `.ass`, so counting sidecars as rival content made an unambiguously
 * media directory fall back to the table. They are attachments, not competitors,
 * so they leave the denominator rather than voting against it.
 */
const partition = (objs: readonly MediaishObj[]) => {
  const media: MediaishObj[] = []
  const rest: MediaishObj[] = []
  for (const o of objs) (hasMediaInfo(o) ? media : rest).push(o)

  // Sorted stems + binary search keeps this O(n log n); a directory can hold
  // thousands of entries and this runs on every listing.
  const stems = media
    .map((o) => stemOf(o.name ?? ""))
    .filter((s) => s.length > 0)
    .sort()

  const hasMediaStemPrefix = (name: string): boolean => {
    let lo = 0
    let hi = stems.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (stems[mid] <= name) lo = mid + 1
      else hi = mid
    }
    // The greatest stem that is <= name is the only possible prefix of it.
    return lo > 0 && name.startsWith(stems[lo - 1])
  }

  let sidecars = 0
  for (const o of rest) {
    if (o.is_dir) continue // a folder is content, never an attachment
    if (hasMediaStemPrefix(o.name ?? "")) sidecars++
  }
  return { media: media.length, contenders: rest.length - sidecars }
}

/**
 * Choose the layout for a directory.
 *
 * The content test is a plain majority of the entries that are actually
 * competing for the layout — more media entries than non-media ones, with each
 * media file's own sidecars discounted. "Majority" is the definition of the
 * word, not a tuned threshold: there is no knob here to get wrong. An empty
 * directory keeps the table, since there is no evidence either way and the table
 * is the established default.
 */
export const shouldUseMediaRows = (
  provider: string | undefined,
  objs: readonly MediaishObj[],
): boolean => {
  if (!isMediaProvider(provider)) return false
  if (!objs.length) return false
  const { media, contenders } = partition(objs)
  return media > contenders
}
