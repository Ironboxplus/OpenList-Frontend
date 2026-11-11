import { Box } from "@hope-ui/solid"
import { createEffect, on, onCleanup, onMount } from "solid-js"
import { useFetch } from "~/hooks"
import { password, setShouldKeepState } from "~/store"
import { PResp } from "~/types"
import { asPreview, r } from "~/utils"
import { registerJassubHost } from "./movi-jassub"
import { SubtitleManager, type SubtitleFile } from "./subtitle-manager"
import {
  buildMoviBufferAttribute,
  buildProviderSubFiles,
  buildQualityList,
  buildSourceHTML,
  type Quality,
  type VideoPlaySource,
  type VideoSubtitleSource,
} from "./movi-quality"

const escapeAttr = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;")

// The font ASS subtitles fall back to when the file embeds none of the ones a
// script names: movi fetches it only when a subtitle needs it.
const fallbackFontAttr = () => {
  const base = `${window.location.origin}${(window as any).__dynamic_base__ || ""}`
  return ` subtitlefallbackfont="${escapeAttr(`Source Han Sans CN|${base}/static/fonts/SourceHanSansCN-Bold.woff2`)}"`
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
  /** Gets the <movi-player> element each time a player is built. */
  onPlayer?: (el: HTMLElement) => void
}

/**
 * The movi-player mount: the <movi-player> element with its `<source>` and
 * `<track>` children. Sources and subtitles are movi's to present and switch;
 * this only declares them. It reads nothing from the file page's stores, so the
 * file preview and the media library overlay feed it the same way.
 */
interface Built {
  seq: number
  manager: SubtitleManager
  el: HTMLElement
}

export const MoviCore = (props: MoviCoreProps) => {
  // Provider transcoded sources are fetched on demand; movi always defaults to
  // the original stream (raw_url) per the product requirement.
  const [, fetchPlaySources] = useFetch((): PResp<VideoPlaySource[]> =>
    r.post("/fs/video_play", { path: props.path, password: password() }),
  )

  // All subtitle tracks for the video, resolved server-side by
  // /fs/video_subtitle: same-name sidecar files (any driver) + provider tracks
  // (e.g. 115 extracts a container's embedded subs during transcoding). Resolving
  // them on the backend keeps the player dumb and lets the transcoded HLS stream
  // show the original file's subtitles even when they were embedded in the mkv.
  const [, fetchSubtitles] = useFetch((): PResp<VideoSubtitleSource[]> =>
    r.post("/fs/video_subtitle", { path: props.path, password: password() }),
  )

  // Best-effort: failures just leave the subtitle list empty. The request can
  // take a while (the backend reads the head of the file to list the tracks the
  // container carries), so the player does not wait for it; see addSubtitles.
  const loadSubtitles = async (): Promise<SubtitleFile[]> => {
    try {
      const resp = await fetchSubtitles()
      const list = resp.code === 200 && resp.data ? resp.data : []
      return buildProviderSubFiles(list)
    } catch {
      return []
    }
  }

  let containerRef: HTMLElement | undefined
  let playerHost: HTMLElement | undefined
  let playerEl: HTMLElement | undefined
  let subtitleManager: SubtitleManager | undefined
  let startApplied = false
  // Builds can overlap (next episode, quick switching) and the UTF-16 check
  // below is async: only the latest build may put a player on the page.
  let buildSeq = 0

  const destroyPlayer = () => {
    subtitleManager?.destroy()
    subtitleManager = undefined
    if (playerEl) {
      if ((playerEl as any).dispose) (playerEl as any).dispose()
      playerEl.remove()
      playerEl = undefined
    }
  }

  // The sources for a freshly-opened video: the original stream is always
  // first/default; 115 transcoded tiers (already proxied) follow.
  const loadQualities = async (originalUrl: string): Promise<Quality[]> => {
    const provider = props.provider
    if (provider !== "115 Open") {
      return buildQualityList(originalUrl, provider, undefined)
    }
    try {
      const resp = await fetchPlaySources()
      const sources = resp.code === 200 ? resp.data : undefined
      return buildQualityList(originalUrl, provider, sources)
    } catch {
      return buildQualityList(originalUrl, undefined, undefined)
    }
  }

  // Only the first build starts at `startAt`; later ones (a new episode's url)
  // start from the beginning.
  const startAttr = () => {
    if (startApplied || !props.startAt || props.startAt <= 5) return ""
    startApplied = true
    return ` startat="${Math.floor(props.startAt)}"`
  }

  const buildPlayer = (
    url: string,
    qualities: Quality[],
  ): Built | undefined => {
    if (!playerHost || !url) return
    const seq = ++buildSeq

    // movi draws ASS (embedded and external) itself; the manager only readies
    // the external files (UTF-16 .ass to UTF-8) and draws external PGS. The
    // subtitle tracks come later, see addSubtitles.
    const manager = new SubtitleManager(null)

    destroyPlayer()

    // More than one source: `<source>` children, which movi presents and
    // switches itself. One source: a plain `src`, as it has always been.
    const sourceHTML = buildSourceHTML(qualities)
    const srcAttr = sourceHTML ? "" : ` src="${escapeAttr(url)}"`
    // The video's identity across a source switch (and a re-render of the same
    // video): position and paused state carry over under the same key.
    const keyAttr = sourceHTML ? ` resumekey="${escapeAttr(props.path)}"` : ""

    const wrapper = document.createElement("div")
    wrapper.style.cssText = "position:relative;width:100%"
    wrapper.innerHTML = `<movi-player${srcAttr}${keyAttr} controls theme="dark" hdr fastseek${startAttr()}${props.autoplay ? " autoplay" : ""}${buildMoviBufferAttribute(props.provider)}${fallbackFontAttr()} style="width:100%;max-height:80vh">${sourceHTML}</movi-player>`

    const el = wrapper.firstElementChild as HTMLElement
    playerHost.appendChild(wrapper)
    playerEl = el

    manager.attach(el)
    subtitleManager = manager
    manager.startPolling()

    el.addEventListener("ended", () => {
      props.onEnded?.()
      if (props.autoNext) props.onNext?.()
    })
    props.onPlayer?.(el)

    el.addEventListener("subtitledelaychange", ((e: CustomEvent) => {
      const delay = e.detail?.subtitleDelay ?? 0
      subtitleManager?.setTimeOffset(delay)
    }) as EventListener)
    return { seq, manager, el }
  }

  // Subtitle tracks resolved by the backend (sidecar + provider). They are
  // declared once, whatever source is playing: movi lists them next to the
  // original's own tracks and carries the choice across a source switch. They
  // arrive after the player was built: appended as <track> children, which movi
  // adds to its list and menu without reloading (HTML: a track element added
  // to a media element joins its text tracks). A list that comes back after the
  // player was replaced is for a video that is gone.
  const addSubtitles = async (built: Built, files: SubtitleFile[]) => {
    if (!files.length || built.seq !== buildSeq) return
    built.manager.registerTracks(files)
    await built.manager.convertAssTracks()
    if (built.seq !== buildSeq) return
    const tracks = document.createElement("template")
    tracks.innerHTML = built.manager.getTrackHTML()
    built.el.append(tracks.content)
  }

  onMount(async () => {
    await import("movi-player")
    await registerJassubHost()

    createEffect(
      on(
        () => asPreview(props.rawUrl),
        async (url) => {
          if (!containerRef || !url) return
          const subtitles = loadSubtitles()
          const built = buildPlayer(url, await loadQualities(url))
          if (built) await addSubtitles(built, await subtitles)
        },
      ),
    )
  })

  onCleanup(() => {
    buildSeq++
    setShouldKeepState(false)
    destroyPlayer()
  })

  return (
    <>
      <Box
        ref={(el: HTMLElement) => (containerRef = el)}
        pos="relative"
        w="$full"
        css={{ "min-height": "320px" }}
      >
        <div ref={(el: HTMLElement) => (playerHost = el)} style="width:100%" />
      </Box>
    </>
  )
}
