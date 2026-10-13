import { apiPost } from "~/platform/api/client"
import { Obj, ObjType } from "~/types"
import { asyncPool } from "./async_pool"
import { mpvCommand, MpvItem } from "./mpv-command"

/**
 * Only video and audio files can be handed to mpv. Decided by `type` alone: a
 * folder has type FOLDER, and `is_dir` is not reliable on `objStore.obj` (loading
 * the sibling list on a preview page sets it to true for the open file).
 */
export const isMpvMedia = (obj: Obj): boolean =>
  obj.type === ObjType.VIDEO || obj.type === ObjType.AUDIO

interface SubtitleEntry {
  url: string
}

/** How many `/fs/video_subtitle` requests run at once for a multi-selection. */
const SUBTITLE_CONCURRENCY = 4

/**
 * The external subtitle links the backend finds for one file (same-name files,
 * subtitle folders, single-video folders; see `FsVideoSubtitle`). `sidecar_only`
 * keeps the request off the storage provider's API: its tracks duplicate the
 * embedded ones mpv reads from the file itself and would cost one rate-limited
 * provider call per video. Throws when the request fails.
 */
export const fetchSidecarSubtitles = async (
  path: string,
  password: string,
): Promise<string[]> => {
  const out = await apiPost<SubtitleEntry[] | null>("/fs/video_subtitle", {
    body: { path, password, sidecar_only: true },
  })
  if (!out.ok) throw new Error(out.error.message)
  return (out.data ?? []).map((s) => s.url).filter(Boolean)
}

export interface MpvCommandDeps {
  /** direct link of a file (`rawLink(obj, true)`) */
  linkOf: (obj: Obj) => string
  /** full path of a file, as `/fs/video_subtitle` expects it */
  pathOf: (obj: Obj) => string
  password: string
  /** false where the backend cannot resolve subtitles (share pages) */
  withSubtitles: boolean
}

/**
 * The mpv command for the media files among `objs`, with their subtitles. Every
 * subtitle request settles before this resolves; a failed request leaves that
 * file without subtitles and sets `subtitleFailed` so the caller can say so.
 */
export const buildMpvCommandFor = async (
  objs: Obj[],
  deps: MpvCommandDeps,
): Promise<{ command: string; count: number; subtitleFailed: boolean }> => {
  const media = objs.filter(isMpvMedia)
  const subUrls: string[][] = media.map(() => [])
  let subtitleFailed = false
  if (deps.withSubtitles) {
    const indices = media.map((_, i) => i)
    for await (const _ of asyncPool(
      SUBTITLE_CONCURRENCY,
      indices,
      async (i) => {
        try {
          subUrls[i] = await fetchSidecarSubtitles(
            deps.pathOf(media[i]),
            deps.password,
          )
        } catch {
          subtitleFailed = true
        }
      },
    )) {
      // drained for completion only
    }
  }
  const items: MpvItem[] = media.map((obj, i) => ({
    url: deps.linkOf(obj),
    subUrls: subUrls[i],
  }))
  return { command: mpvCommand(items), count: media.length, subtitleFailed }
}
