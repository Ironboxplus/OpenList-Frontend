import { createEffect, on, onCleanup, onMount } from "solid-js"
import { useFetch } from "~/hooks"
import { password, setShouldKeepState } from "~/store"
import { PResp } from "~/types"
import { asPreview, r } from "~/utils"
import { registerJassubHost } from "./movi-jassub"
import { SubtitleManager, type SubtitleFile } from "./subtitle-manager"
import {
  moviBufferSizeForProvider,
  buildProviderSubFiles,
  buildQualityList,
  buildSourceHTML,
  type Quality,
  type VideoPlaySource,
  type VideoSubtitleSource,
} from "./movi-quality"

// The font ASS subtitles fall back to when the file embeds none of the ones a
// script names: movi fetches it only when a subtitle needs it.
const fallbackFont = () => {
  const base = `${window.location.origin}${(window as any).__dynamic_base__ || ""}`
  return `Source Han Sans CN|${base}/static/fonts/SourceHanSansCN-Bold.woff2`
}

export interface MoviCoreProps {
  /** VFS path of the video, for /fs/video_play and /fs/video_subtitle. */
  path: string
  /** The original stream (fs/get raw_url); the preview marker is added here. */
  rawUrl: string
  /** Storage provider of the file; picks the buffer tuning and the 115 tiers. */
  provider: string
  /** Play on when this video ends. */
  autoNext?: boolean
  onNext?: () => void
  /** Fired on every end of playback, before the auto-next decision. */
  onEnded?: () => void
  /** Start the first source here (seconds), through movi's startat attribute. */
  startAt?: number
  /** Start playing as soon as the source is ready. */
  autoplay?: boolean
  /** Gets the <movi-player> element once it is made. */
  onPlayer?: (el: HTMLElement) => void
  /** The element fills its box (the docked player sizes the box). */
  fill?: boolean
}

/**
 * The movi-player mount: one <movi-player> for the life of this component,
 * with its `<source>` and `<track>` children. Another video is another set of
 * children (or another `src`) on the same element: movi reloads in place, and
 * fullscreen, the unlocked audio and the volume stay (movi-player README,
 * "Queues the host loads"; MoviElement._watchSourceChildren). Sources and
 * subtitles are movi's to present and switch; this only declares them. It reads
 * nothing from the file page's stores, so the docked player and the media
 * library overlay feed it the same way.
 */
export const MoviCore = (props: MoviCoreProps) => {
  // Provider transcoded sources are fetched on demand; movi always defaults to
  // the original stream (raw_url) per the product requirement.
  const [, fetchPlaySources] = useFetch(
    (path: string): PResp<VideoPlaySource[]> =>
      r.post("/fs/video_play", { path, password: password() }),
  )

  // All subtitle tracks for the video, resolved server-side by
  // /fs/video_subtitle: same-name sidecar files (any driver) + provider tracks
  // (e.g. 115 extracts a container's embedded subs during transcoding). Resolving
  // them on the backend keeps the player dumb and lets the transcoded HLS stream
  // show the original file's subtitles even when they were embedded in the mkv.
  const [, fetchSubtitles] = useFetch(
    (path: string): PResp<VideoSubtitleSource[]> =>
      r.post("/fs/video_subtitle", { path, password: password() }),
  )

  // Best-effort: failures just leave the subtitle list empty. The request can
  // take a while (the backend reads the head of the file to list the tracks the
  // container carries), so the player does not wait for it; see addSubtitles.
  const loadSubtitles = async (path: string): Promise<SubtitleFile[]> => {
    try {
      const resp = await fetchSubtitles(path)
      const list = resp.code === 200 && resp.data ? resp.data : []
      return buildProviderSubFiles(list)
    } catch {
      return []
    }
  }

  let host: HTMLDivElement | undefined
  let player: HTMLElement | undefined
  let subtitleManager: SubtitleManager | undefined
  // Loads can overlap (next episode, quick switching) and the subtitle steps
  // are async: only the latest load may touch the element.
  let loadSeq = 0

  // The sources for a freshly-opened video: the original stream is always
  // first/default; 115 transcoded tiers (already proxied) follow.
  const loadQualities = async (
    path: string,
    originalUrl: string,
  ): Promise<Quality[]> => {
    const provider = props.provider
    if (provider !== "115 Open") {
      return buildQualityList(originalUrl, provider, undefined)
    }
    try {
      const resp = await fetchPlaySources(path)
      const sources = resp.code === 200 ? resp.data : undefined
      return buildQualityList(originalUrl, provider, sources)
    } catch {
      return buildQualityList(originalUrl, undefined, undefined)
    }
  }

  /** The one element of this mount, made when the first video comes. */
  const make = () => {
    const el = document.createElement("movi-player")
    for (const a of ["controls", "hdr", "fastseek"]) el.setAttribute(a, "")
    el.setAttribute("theme", "dark")
    if (props.autoplay) el.setAttribute("autoplay", "")
    // Only the first video starts at `startAt`; later ones start from the top.
    if (props.startAt && props.startAt > 5)
      el.setAttribute("startat", String(Math.floor(props.startAt)))
    const buffer = moviBufferSizeForProvider(props.provider)
    if (buffer > 0) el.setAttribute("buffersize", String(buffer))
    el.setAttribute("subtitlefallbackfont", fallbackFont())
    el.style.cssText = props.fill
      ? "display:block;width:100%;height:100%"
      : "display:block;width:100%;max-height:80vh"
    el.addEventListener("ended", () => {
      props.onEnded?.()
      if (props.autoNext) props.onNext?.()
    })
    el.addEventListener("subtitledelaychange", ((e: CustomEvent) => {
      subtitleManager?.setTimeOffset(e.detail?.subtitleDelay ?? 0)
    }) as EventListener)
    host!.appendChild(el)
    props.onPlayer?.(el)
    return el
  }

  /**
   * Declares a video on the element. The old video's subtitle tracks leave
   * first (P2: the new one must not inherit them); more than one source is a
   * `<source>` ladder, which movi presents and switches itself; one source is
   * a plain `src`, as it has always been.
   */
  const declare = (
    el: HTMLElement,
    path: string,
    url: string,
    q: Quality[],
  ) => {
    el.querySelectorAll("track").forEach((t) => t.remove())
    const sourceHTML = buildSourceHTML(q)
    if (sourceHTML) {
      // The video's identity across a source switch (and a re-render of the
      // same video): position and paused state carry over under the same key.
      el.setAttribute("resumekey", path)
      el.querySelectorAll("source").forEach((s) => s.remove())
      const t = document.createElement("template")
      t.innerHTML = sourceHTML
      el.append(t.content)
    } else {
      el.removeAttribute("resumekey")
      el.setAttribute("src", url)
      el.querySelectorAll("source").forEach((s) => s.remove())
    }
  }

  // Subtitle tracks resolved by the backend (sidecar + provider). They are
  // declared once, whatever source is playing: movi lists them next to the
  // original's own tracks and carries the choice across a source switch. They
  // arrive after the video was declared: appended as <track> children, which
  // movi adds to its list and menu without reloading (HTML: a track element
  // added to a media element joins its text tracks). A list that comes back
  // after another video was declared is for a video that is gone.
  const addSubtitles = async (
    seq: number,
    manager: SubtitleManager,
    el: HTMLElement,
    files: SubtitleFile[],
  ) => {
    if (!files.length || seq !== loadSeq) return
    manager.registerTracks(files)
    await manager.convertAssTracks()
    if (seq !== loadSeq) return
    const tracks = document.createElement("template")
    tracks.innerHTML = manager.getTrackHTML()
    el.append(tracks.content)
  }

  const load = async (path: string, url: string) => {
    const seq = ++loadSeq
    const subtitles = loadSubtitles(path)
    const qualities = await loadQualities(path, url)
    if (seq !== loadSeq || !host) return
    const first = !player
    const el = player ?? (player = make())
    if (!first) el.removeAttribute("startat")
    // movi draws ASS (embedded and external) itself; the manager only readies
    // the external files (UTF-16 .ass to UTF-8) and draws external PGS. One
    // manager per video, on the same element.
    subtitleManager?.destroy()
    const manager = new SubtitleManager(null)
    subtitleManager = manager
    declare(el, path, url, qualities)
    manager.attach(el)
    manager.startPolling()
    await addSubtitles(seq, manager, el, await subtitles)
  }

  onMount(async () => {
    await import("movi-player")
    await registerJassubHost()

    createEffect(
      on(
        () => [props.path, asPreview(props.rawUrl)] as const,
        ([path, url]) => {
          if (path && url) void load(path, url)
        },
      ),
    )
  })

  onCleanup(() => {
    loadSeq++
    setShouldKeepState(false)
    subtitleManager?.destroy()
    subtitleManager = undefined
    if (player) {
      if ((player as any).dispose) (player as any).dispose()
      player.remove()
      player = undefined
    }
  })

  return (
    <div
      ref={host}
      style={
        props.fill
          ? { width: "100%", height: "100%" }
          : { position: "relative", width: "100%", "min-height": "320px" }
      }
    />
  )
}
