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
import {
  buildQualityList,
  ORIGINAL_LABEL,
  qualitySwitchPlan,
  type Quality,
  type VideoPlaySource,
} from "./movi-quality"

const escapeAttr = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;")

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
  // Mirrors movi-player's own control-bar visibility so the quality overlay
  // fades out together with the controls (and reappears on hover / while paused)
  // instead of being permanently pinned to the top-right corner.
  const [barVisible, setBarVisible] = createSignal(true)
  const currentLabel = () =>
    qualities().find((q) => q.url === currentUrl())?.label ?? ORIGINAL_LABEL

  let containerRef: HTMLElement | undefined
  let playerHost: HTMLElement | undefined
  let playerEl: HTMLElement | undefined
  let subtitleManager: SubtitleManager | undefined
  let controlsObserver: MutationObserver | undefined
  let controlsRaf: number | undefined

  // Watch movi-player's shadow-DOM control bar and mirror its visibility onto
  // the quality overlay. movi toggles `movi-controls-hidden` on the
  // `.movi-controls-container` element when the bar auto-hides; the overlay
  // follows that so it isn't stuck on screen. shadowRoot is mode:"open".
  const observeControls = (host: HTMLElement) => {
    let tries = 0
    const attach = () => {
      const bar = host.shadowRoot?.querySelector(
        ".movi-controls-container",
      ) as HTMLElement | null
      if (!bar) {
        // The custom element builds its shadow tree asynchronously; retry for a
        // couple of seconds, then give up (overlay just stays at its default).
        if (tries++ < 120) controlsRaf = requestAnimationFrame(attach)
        return
      }
      // Hide movi's built-in quality/rendition menu: it's redundant with our
      // cross-source quality overlay (movi's only switches renditions within a
      // single HLS source, and 115 transcoded streams expose a single rendition).
      const sr = host.shadowRoot
      if (sr && !sr.querySelector("style[data-ol-hide-quality]")) {
        const st = document.createElement("style")
        st.setAttribute("data-ol-hide-quality", "")
        st.textContent = ".movi-quality-container{display:none !important}"
        sr.appendChild(st)
      }
      const sync = () =>
        setBarVisible(!bar.classList.contains("movi-controls-hidden"))
      sync()
      controlsObserver = new MutationObserver(sync)
      controlsObserver.observe(bar, {
        attributes: true,
        attributeFilter: ["class"],
      })
    }
    attach()
  }

  const destroyPlayer = () => {
    controlsObserver?.disconnect()
    controlsObserver = undefined
    if (controlsRaf !== undefined) {
      cancelAnimationFrame(controlsRaf)
      controlsRaf = undefined
    }
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
    const provider = objStore.provider
    if (provider !== "115 Open") {
      setQualities(buildQualityList(originalUrl, provider, undefined))
      return
    }
    try {
      const resp = await fetchPlaySources()
      const sources = resp.code === 200 ? resp.data : undefined
      setQualities(buildQualityList(originalUrl, provider, sources))
    } catch {
      setQualities(buildQualityList(originalUrl, undefined, undefined))
    }
  }

  const buildPlayer = async (url: string) => {
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
    setBarVisible(true)
    observeControls(el)

    subtitleManager = new SubtitleManager(el)
    subtitleManager.registerTracks(subs)
    // UTF-16 .ass (common in older fansubs) can't be parsed by JASSUB — transcode
    // to UTF-8 before polling activates the renderer, else nothing shows at all.
    await subtitleManager.convertAssTracks()
    subtitleManager.startPolling()

    el.addEventListener("ended", () => {
      if (autoNext()) next_video()
    })

    el.addEventListener("subtitledelaychange", ((e: CustomEvent) => {
      const delay = e.detail?.subtitleDelay ?? 0
      subtitleManager?.setTimeOffset(delay)
    }) as EventListener)
  }

  // Swap quality WITHOUT tearing down the element: movi's own `src` setter
  // disposes its inner player and re-loads, but the <movi-player> element (and
  // its <track> children + our SubtitleManager) survive — so movi re-applies the
  // original file's external/sidecar subtitles onto the transcoded HLS source.
  // This is the fix for "switching quality drops the subtitles". No movi changes.
  // Best-effort restore of playback position and the active subtitle selection.
  const switchSource = (url: string, restoreTime: number) => {
    if (qualitySwitchPlan(!!playerEl) === "build") {
      buildPlayer(url)
      return
    }
    const el = playerEl!
    const activeLang =
      (el as any).getSubtitleLangs?.()?.find((t: any) => t.active)?.lang ?? null
    const restore = () => {
      try {
        if (restoreTime > 0) (el as any).currentTime = restoreTime
        if (activeLang) (el as any).selectSubtitleLang?.(activeLang)
      } catch {}
      el.removeEventListener("loadeddata", restore)
      el.removeEventListener("canplay", restore)
    }
    el.addEventListener("loadeddata", restore)
    el.addEventListener("canplay", restore)
    ;(el as any).src = url
  }

  const selectQuality = (q: Quality) => {
    setMenuOpen(false)
    if (q.url === currentUrl()) return
    const resumeAt = playerEl ? (playerEl as any).currentTime || 0 : 0
    setCurrentUrl(q.url)
    switchSource(q.url, resumeAt)
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
              // Follow the control bar: fade out when movi hides its controls,
              // but stay put while the quality menu is open.
              opacity: barVisible() || menuOpen() ? "1" : "0",
              "pointer-events": barVisible() || menuOpen() ? "auto" : "none",
              transition: "opacity 0.2s ease",
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
