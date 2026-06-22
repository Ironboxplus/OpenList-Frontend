import { Box } from "@hope-ui/solid"
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  on,
  onCleanup,
  onMount,
  Show,
} from "solid-js"
import { useFetch, useLink, useRouter } from "~/hooks"
import { objStore, password, setShouldKeepState } from "~/store"
import { ObjType, PResp } from "~/types"
import { pathDir, pathJoin, r } from "~/utils"
import { VideoBox } from "./video_box"
import { useNavigate } from "@solidjs/router"
import { SubtitleManager } from "./subtitle-manager"

const escapeAttr = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;")

// 115's online-play (transcoded) sources, already wrapped in OpenList's signed
// /video_proxy by the backend so they are fetched same-origin (no CORS).
interface VideoPlaySource {
  resolution: string
  definition: number
  url: string
}

interface Quality {
  label: string
  url: string
}

const ORIGINAL_LABEL = "原画"

const Preview = () => {
  const { proxyLink } = useLink()
  const { pathname } = useRouter()
  const navigate = useNavigate()

  const videos = createMemo(() =>
    objStore.objs.filter((obj) => obj.type === ObjType.VIDEO),
  )

  const next_video = () => {
    const index = videos().findIndex((f) => f.name === objStore.obj.name)
    if (index < videos().length - 1) {
      navigate(pathJoin(pathDir(location.pathname), videos()[index + 1].name))
    }
  }

  const subtitleFiles = createMemo(() =>
    objStore.related.filter((obj) => {
      const name = obj.name.toLowerCase()
      return (
        name.endsWith(".srt") ||
        name.endsWith(".ass") ||
        name.endsWith(".vtt") ||
        name.endsWith(".sup")
      )
    }),
  )

  // Provider transcoded sources are fetched on demand; movi always defaults to
  // the original stream (raw_url) per the product requirement.
  const [, fetchPlaySources] = useFetch(
    (): PResp<VideoPlaySource[]> =>
      r.post("/fs/video_play", { path: pathname(), password: password() }),
  )

  const [qualities, setQualities] = createSignal<Quality[]>([])
  const [currentUrl, setCurrentUrl] = createSignal("")
  const [menuOpen, setMenuOpen] = createSignal(false)
  const currentLabel = () =>
    qualities().find((q) => q.url === currentUrl())?.label ?? ORIGINAL_LABEL

  let containerRef: HTMLElement | undefined
  let playerHost: HTMLElement | undefined
  let playerEl: HTMLElement | undefined
  let subtitleManager: SubtitleManager | undefined

  const destroyPlayer = () => {
    subtitleManager?.destroy()
    subtitleManager = undefined
    if (playerEl) {
      if ((playerEl as any).dispose) (playerEl as any).dispose()
      playerEl.remove()
      playerEl = undefined
    }
  }

  // Build the quality list for a freshly-opened video: the original stream is
  // always first/default; 115 transcoded tiers (already proxied) follow.
  const loadQualities = async (originalUrl: string) => {
    const original: Quality = { label: ORIGINAL_LABEL, url: originalUrl }
    if (objStore.provider !== "115 Open") {
      setQualities([original])
      return
    }
    try {
      const resp = await fetchPlaySources()
      if (resp.code !== 200 || !resp.data) {
        setQualities([original])
        return
      }
      const tiers = resp.data
        .filter((s) => s.url)
        .map((s) => ({
          label: s.resolution || `${s.definition}P`,
          url: s.url,
        }))
      setQualities(tiers.length ? [original, ...tiers] : [original])
    } catch {
      setQualities([original])
    }
  }

  const buildPlayer = async (url: string, restoreTime?: number) => {
    if (!playerHost || !url) return

    destroyPlayer()

    const trackGen = new SubtitleManager(null as any)
    const subs = subtitleFiles().map((sub) => ({
      name: sub.name,
      url: proxyLink(sub, true),
    }))
    trackGen.registerTracks(subs)
    await trackGen.convertSrtTracks()
    const trackHTML = trackGen.getTrackHTML()
    trackGen.destroy()

    const wrapper = document.createElement("div")
    wrapper.style.cssText = "position:relative;width:100%"
    wrapper.innerHTML = `<movi-player src="${escapeAttr(url)}" controls theme="dark" hdr fastseek style="width:100%;max-height:80vh">${trackHTML}</movi-player>`

    const el = wrapper.firstElementChild as HTMLElement
    playerHost.appendChild(wrapper)
    playerEl = el

    subtitleManager = new SubtitleManager(el)
    subtitleManager.registerTracks(subs)
    subtitleManager.startPolling()

    el.addEventListener("ended", () => {
      if (autoNext()) next_video()
    })

    el.addEventListener("subtitledelaychange", ((e: CustomEvent) => {
      const delay = e.detail?.subtitleDelay ?? 0
      subtitleManager?.setTimeOffset(delay)
    }) as EventListener)

    // Quality switching recreates the player (movi has no in-place source swap
    // for mixed mp4/HLS); best-effort restore of the playback position.
    if (restoreTime && restoreTime > 0) {
      const restore = () => {
        try {
          ;(el as any).currentTime = restoreTime
        } catch {}
        el.removeEventListener("loadeddata", restore)
        el.removeEventListener("canplay", restore)
      }
      el.addEventListener("loadeddata", restore)
      el.addEventListener("canplay", restore)
    }
  }

  const selectQuality = (q: Quality) => {
    setMenuOpen(false)
    if (q.url === currentUrl()) return
    const resumeAt = playerEl ? (playerEl as any).currentTime || 0 : 0
    setCurrentUrl(q.url)
    buildPlayer(q.url, resumeAt)
  }

  onMount(async () => {
    await import("movi-player")

    createEffect(
      on(
        () => objStore.raw_url,
        async (url) => {
          if (!containerRef || !url) return
          setMenuOpen(false)
          await loadQualities(url)
          setCurrentUrl(url)
          await buildPlayer(url)
        },
      ),
    )
  })

  onCleanup(() => {
    setShouldKeepState(false)
    destroyPlayer()
  })

  const [autoNext, setAutoNext] = createSignal(false)

  return (
    <VideoBox onAutoNextChange={setAutoNext}>
      <Box
        ref={(el: HTMLElement) => (containerRef = el)}
        pos="relative"
        w="$full"
        css={{ "min-height": "320px" }}
      >
        <div ref={(el: HTMLElement) => (playerHost = el)} style="width:100%" />
        <Show when={qualities().length > 1}>
          <div
            style={{
              position: "absolute",
              top: "8px",
              right: "8px",
              "z-index": "60",
              "font-size": "13px",
              "user-select": "none",
            }}
            on:click={(e: MouseEvent) => e.stopPropagation()}
          >
            <div
              on:click={() => setMenuOpen(!menuOpen())}
              style={{
                padding: "4px 10px",
                "border-radius": "6px",
                background: "rgba(0,0,0,0.55)",
                color: "#fff",
                cursor: "pointer",
                "backdrop-filter": "blur(4px)",
              }}
            >
              {currentLabel()} ▾
            </div>
            <Show when={menuOpen()}>
              <div
                style={{
                  "margin-top": "4px",
                  "border-radius": "6px",
                  overflow: "hidden",
                  background: "rgba(0,0,0,0.75)",
                  "backdrop-filter": "blur(4px)",
                  "min-width": "96px",
                }}
              >
                <For each={qualities()}>
                  {(q) => (
                    <div
                      on:click={() => selectQuality(q)}
                      style={{
                        padding: "6px 12px",
                        cursor: "pointer",
                        color: q.url === currentUrl() ? "#4ea1ff" : "#fff",
                        "font-weight": q.url === currentUrl() ? "600" : "400",
                      }}
                    >
                      {q.label}
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </div>
        </Show>
      </Box>
    </VideoBox>
  )
}

export default Preview
