// Pure, framework-free helpers for the movi-player quality selector. Kept out of
// movi_video.tsx so they can be unit-tested without importing the player
// component (which pulls in Artplayer / movi-player / WASM at module load).

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
}

export const ORIGINAL_LABEL = "原画"
export const MOVI_115_OPEN_BUFFER_MB = 1024

// Original 115 Remux streams can burst/stall hard enough that movi-player's
// 250MB default HTTP window is only a short cushion. Keep the larger window
// provider-scoped so other backends retain movi's default memory profile.
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
// contains ".m3u8" (MoviElement's isAdaptive check). The signed /video_proxy URL
// has no such extension, so append it as a URL fragment: the browser strips the
// fragment before the HTTP request (proxy + signature unaffected), but movi
// routes the source through its HLS engine instead of the raw demuxer.
export const withHlsHint = (url: string) =>
  url.toLowerCase().includes(".m3u8") ? url : `${url}#.m3u8`

// Build the quality list shown in the overlay. The original stream is always
// first/default; 115's transcoded tiers (proxied, HLS-hinted) follow. Returns
// only the original when the provider isn't 115 or there are no usable tiers.
export const buildQualityList = (
  originalUrl: string,
  provider: string | undefined,
  sources: VideoPlaySource[] | undefined,
): Quality[] => {
  const original: Quality = { label: ORIGINAL_LABEL, url: originalUrl }
  if (provider !== "115 Open" || !sources) return [original]
  const tiers = sources
    .filter((s) => s.url)
    .map((s) => ({
      label:
        s.resolution || DEFINITION_LABELS[s.definition] || `${s.definition}P`,
      url: withHlsHint(s.url),
    }))
  return tiers.length ? [original, ...tiers] : [original]
}

// A provider subtitle track (from /fs/video_subtitle, e.g. 115 extracts a
// container's embedded subtitles during transcoding and serves them as files).
// Already wrapped in OpenList's signed /video_proxy by the backend.
export interface VideoSubtitleSource {
  language: string
  title: string
  url: string
  type: string
}

// Map provider subtitle sources to SubtitleManager track entries. The track
// `name` carries the format extension (e.g. ".srt"/".ass") because
// SubtitleManager.detectFormat() picks the renderer from the extension. These
// are independent of the play source, so they render on every quality tier —
// including transcoded HLS that drops the original embedded subtitle tracks.
export const buildProviderSubFiles = (
  subs: VideoSubtitleSource[] | undefined,
): { name: string; url: string }[] =>
  (subs ?? [])
    .filter((s) => s.url)
    .map((s, i) => ({
      name: `${s.title || s.language || `字幕${i + 1}`}.${(
        s.type || "srt"
      ).toLowerCase()}`,
      url: s.url,
    }))

// The fix for "switching quality drops the subtitles": when a player element is
// already live, switch its source IN PLACE (keeps the <track> children and the
// SubtitleManager alive, so movi re-applies the original file's external/sidecar
// subtitles onto the transcoded HLS source). Only build a fresh element when
// none exists yet (initial load / navigating to a different video).
export const qualitySwitchPlan = (hasLivePlayer: boolean): "swap" | "build" =>
  hasLivePlayer ? "swap" : "build"
