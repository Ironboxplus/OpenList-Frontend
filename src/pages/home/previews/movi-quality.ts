import type { SubtitleFile } from "./subtitle-manager"

// Pure, framework-free helpers that turn a video's sources and subtitles into the
// `<source>` / `<track>` children movi-player reads. Kept out of movi_core.tsx so
// they can be unit-tested without importing the player component (which pulls
// in movi-player / WASM at module load).

// 115's online-play (transcoded) sources, already wrapped in OpenList's signed
// /video_proxy by the backend so they are fetched same-origin (no CORS).
export interface VideoPlaySource {
  resolution: string
  definition: number
  url: string
}

export interface Quality {
  label: string
  url: string
  /** Picture height, for movi's menu order; 0 when nothing says. */
  height: number
}

export const ORIGINAL_LABEL = "原画"
// Original 115 Remux streams can burst/stall hard enough that movi-player's
// 250MB default HTTP window is only a short cushion. movi caps the forward
// download window at 512MB (MAX_STREAM_BUFFER_SIZE), so 640MB is enough to
// unlock the full 512MB window (min(512, 640*0.9=576)) plus headroom — a
// larger value (we used 1024) just allocated a bigger SharedArrayBuffer whose
// top half never fills. Provider-scoped so other backends keep movi's default.
export const MOVI_115_OPEN_BUFFER_MB = 640

export const moviBufferSizeForProvider = (provider: string | undefined) =>
  provider === "115 Open" ? MOVI_115_OPEN_BUFFER_MB : 0

export const buildMoviBufferAttribute = (provider: string | undefined) => {
  const size = moviBufferSizeForProvider(provider)
  return size > 0 ? ` buffersize="${size}"` : ""
}

// 115's video_play sometimes returns an empty `resolution`; map the numeric
// definition to a friendly label as a fallback (definition 4 == 1080P, etc).
export const DEFINITION_LABELS: Record<number, string> = {
  1: "360P",
  2: "480P",
  3: "720P",
  4: "1080P",
  5: "4K",
}

// movi-player only treats a source as an adaptive HLS stream when the src string
// contains ".m3u8". The signed /video_proxy URL
// has no such extension, so append it as a URL fragment: the browser strips the
// fragment before the HTTP request (proxy + signature unaffected), but movi
// routes the source through its HLS engine instead of the raw demuxer.
export const withHlsHint = (url: string) =>
  url.toLowerCase().includes(".m3u8") ? url : `${url}#.m3u8`

// Picture height of a 115 tier, from its label ("1080P", "4K") or, when 115
// leaves the label empty, its definition number.
export const DEFINITION_HEIGHTS: Record<number, number> = {
  1: 360,
  2: 480,
  3: 720,
  4: 1080,
  5: 2160,
}

export const tierHeight = (label: string, definition: number): number => {
  const p = /(\d{3,4})\s*p/i.exec(label)
  if (p) return parseInt(p[1], 10)
  if (/4k/i.test(label)) return 2160
  return DEFINITION_HEIGHTS[definition] ?? 0
}

// Build the source list handed to movi. The original stream is always first and
// the default; 115's transcoded tiers (proxied, HLS-hinted) follow. Returns only
// the original when the provider isn't 115 or there are no usable tiers.
//
// The original's height is not known here (the media info lives elsewhere), so
// it takes the highest tier's: a transcode never exceeds its source, and equal
// heights keep document order in movi's menu, which puts the original on top.
export const buildQualityList = (
  originalUrl: string,
  provider: string | undefined,
  sources: VideoPlaySource[] | undefined,
): Quality[] => {
  const single: Quality[] = [
    { label: ORIGINAL_LABEL, url: originalUrl, height: 0 },
  ]
  if (provider !== "115 Open" || !sources) return single
  const tiers = sources
    .filter((s) => s.url)
    .map((s) => {
      const label =
        s.resolution || DEFINITION_LABELS[s.definition] || `${s.definition}P`
      return {
        label,
        url: withHlsHint(s.url),
        height: tierHeight(label, s.definition),
      }
    })
  if (!tiers.length) return single
  const top = Math.max(...tiers.map((t) => t.height))
  return [{ label: ORIGINAL_LABEL, url: originalUrl, height: top }, ...tiers]
}

const escapeHtmlAttr = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;")

// The `<source>` children for a list with more than one entry, original first
// and marked `data-default`: movi shows these as its own source menu, also while
// an HLS entry is playing, and keeps position, pause state and the chosen
// subtitle across a switch. A single source stays a plain `src` attribute, so
// the usual (non-115) case is the one movi has always run.
export const buildSourceHTML = (qualities: Quality[]): string =>
  qualities.length < 2
    ? ""
    : qualities
        .map(
          (q, i) =>
            `<source src="${escapeHtmlAttr(q.url)}" data-label="${escapeHtmlAttr(q.label)}" data-height="${q.height}"${i === 0 ? " data-default" : ""}>`,
        )
        .join("")

// A provider subtitle track (from /fs/video_subtitle, e.g. 115 extracts a
// container's embedded subtitles during transcoding and serves them as files).
// Already wrapped in OpenList's signed /video_proxy by the backend.
export interface VideoSubtitleSource {
  language: string
  title: string
  url: string
  type: string
  /** Set for a track 115 extracted from the container: its own title and its
   *  position among the container's subtitle streams. */
  embedded_title?: string
  embedded_order?: number
}

// Map provider subtitle sources to SubtitleManager track entries. The track
// `name` carries the format extension (e.g. ".srt"/".ass") because
// SubtitleManager.detectFormat() picks the renderer from the extension. An
// extracted container track also carries its in-band identity, which movi uses
// to treat the file and the original's own track as one subtitle.
export const buildProviderSubFiles = (
  subs: VideoSubtitleSource[] | undefined,
): SubtitleFile[] =>
  (subs ?? [])
    .filter((s) => s.url)
    .map((s, i) => ({
      name: `${s.title || s.language || `字幕${i + 1}`}.${(
        s.type || "srt"
      ).toLowerCase()}`,
      url: s.url,
      ...(s.embedded_title && typeof s.embedded_order === "number"
        ? {
            inbandTitle: s.embedded_title,
            inbandOrder: s.embedded_order,
          }
        : {}),
    }))
