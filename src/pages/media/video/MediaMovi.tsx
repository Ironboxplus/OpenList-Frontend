import { createResource, onCleanup, Show } from "solid-js"
import { MoviCore } from "~/pages/home/previews/movi_core"
import { saveMediaProgress } from "~/utils/media_api"
import { r } from "~/utils"
import { createProgressTracker } from "./player-choice"
import type { FsGetResp } from "~/types"

/**
 * Plays a library video with movi-player: the file's raw_url and provider come
 * from fs/get of its path, exactly what the file page hands the same player.
 * Resume and progress ride on the movi element's own currentTime and events.
 */
export const MediaMovi = (props: {
  itemId: number
  episodeIndex: number
  /** VFS path of the file */
  path: string
  resumeSeconds: number
  /** fs/get did not give a stream: let the overlay fall back */
  onFail: () => void
  /** latest position, for a player switch to continue from */
  onTime: (seconds: number) => void
}) => {
  const [file] = createResource(
    () => props.path,
    async (path) => {
      try {
        const resp = (await r.post("/fs/get", {
          path,
          password: "",
        })) as FsGetResp
        if (resp.code === 200 && resp.data?.raw_url) {
          return { rawUrl: resp.data.raw_url, provider: resp.data.provider }
        }
      } catch {
        // falls through to onFail
      }
      props.onFail()
      return undefined
    },
  )

  const tracker = createProgressTracker((p) => {
    saveMediaProgress({
      item_id: props.itemId,
      episode_index: props.episodeIndex,
      position: p.position,
      duration: p.duration,
      played: p.played,
    }).catch(() => {
      /* ignore */
    })
  })
  onCleanup(() => tracker.close())

  const attach = (el: HTMLElement) => {
    const m = el as HTMLElement & { currentTime: number; duration: number }
    const at = () => [m.currentTime || 0, m.duration || 0] as const
    el.addEventListener("timeupdate", () => {
      tracker.timeupdate(...at())
      props.onTime(tracker.position())
    })
    el.addEventListener("pause", () => tracker.pause(...at()))
    el.addEventListener("ended", () => tracker.ended(...at()))
  }

  return (
    <Show when={file()}>
      {(f) => (
        <div style={{ width: "100%", height: "100%", overflow: "auto" }}>
          <MoviCore
            path={props.path}
            rawUrl={f().rawUrl}
            provider={f().provider}
            startAt={props.resumeSeconds}
            autoplay
            onPlayer={attach}
          />
        </div>
      )}
    </Show>
  )
}
