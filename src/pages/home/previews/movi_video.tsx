import { Box } from "@hope-ui/solid"
import {
  createEffect,
  createMemo,
  createSignal,
  on,
  onCleanup,
  onMount,
} from "solid-js"
import { useLink } from "~/hooks"
import { objStore, setShouldKeepState } from "~/store"
import { ObjType } from "~/types"
import { pathDir, pathJoin } from "~/utils"
import { VideoBox } from "./video_box"
import { useNavigate } from "@solidjs/router"
import { SubtitleManager } from "./subtitle-manager"

const escapeAttr = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;")

const Preview = () => {
  const { proxyLink } = useLink()
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

  let containerRef: HTMLElement | undefined
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

  onMount(async () => {
    await import("movi-player")

    createEffect(
      on(
        () => objStore.raw_url,
        async (url) => {
          if (!containerRef || !url) return

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
          containerRef.appendChild(wrapper)
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
        w="$full"
        css={{ "min-height": "320px" }}
      />
    </VideoBox>
  )
}

export default Preview
