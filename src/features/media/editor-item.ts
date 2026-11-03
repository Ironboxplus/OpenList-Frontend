// What the media editor needs to know about the work it edits, independent of
// where the host got it from (the video detail page, the file browser). Pure.
import { mediaTitle, parseCandidates } from "~/types"
import type { MediaCandidate, MediaItem } from "~/types"
import { resolveMediaCover } from "~/utils/media_cover"
import type { MediaSetBody } from "./client"
import type { MediaKind } from "./types"

export interface EditorItem {
  path: string
  kind: MediaKind
  title: string
  original_title: string
  year: number
  overview: string
  locked: boolean
  confidence: number
  candidates: MediaCandidate[]
  /** Ready-to-use cover address, for the preview next to the poster field. */
  cover: string
}

const KNOWN: readonly string[] = ["movie", "tv", "anime", "collection"]

/** The editor's view of an item the public media API returned. */
export const fromMediaItem = (it: MediaItem): EditorItem => ({
  path: it.path ?? "",
  kind: (KNOWN.includes(it.video_type) ? it.video_type : "movie") as MediaKind,
  title: mediaTitle(it),
  original_title: it.original_title ?? "",
  year: Number((it.release_date ?? "").slice(0, 4)) || 0,
  overview: it.plot || it.description || "",
  locked: !!it.locked,
  confidence: it.confidence ?? 1,
  candidates: parseCandidates(it),
  cover: resolveMediaCover(it),
})

export interface DetailsForm {
  title: string
  original_title: string
  year: string
  overview: string
}

/**
 * The curate/set body for a details form: only what differs from the item is
 * sent (the endpoint writes just the fields it is given), and a year that is
 * not a number is left out instead of being sent as 0.
 */
export const detailsBody = (
  item: EditorItem,
  form: DetailsForm,
): MediaSetBody => {
  const body: MediaSetBody = { path: item.path }
  const title = form.title.trim()
  if (title && title !== item.title) body.title = title
  const original = form.original_title.trim()
  if (original !== item.original_title) body.original_title = original
  const year = Number.parseInt(form.year, 10)
  if (Number.isFinite(year) && year > 0 && year !== item.year) body.year = year
  const overview = form.overview.trim()
  if (overview !== item.overview) body.overview = overview
  return body
}

/** Nothing but the path: there is nothing to save. */
export const isEmptyBody = (body: MediaSetBody): boolean =>
  Object.keys(body).length <= 1
