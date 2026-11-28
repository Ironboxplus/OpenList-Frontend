import { asPreview } from "~/utils"
import { onCleanup, onMount } from "solid-js"
import { getSettingBool, objStore } from "~/store"
import View360, { ControlBar, EquirectProjection } from "@egjs/view360"
import "@egjs/view360/css/view360.min.css"
import "./video360.css"

const Preview = () => {
  let viewer: View360

  onMount(() => {
    const container = document.getElementById("view360-container")
    const video = document.getElementById("view360-video")

    if (container && video) {
      viewer = new View360(container, {
        projection: new EquirectProjection({
          src: video,
          video: {
            autoplay: getSettingBool("video_autoplay"),
          },
        }),
        plugins: [
          new ControlBar({
            pieView: { order: 0 },
            gyroButton: { position: "top-right", order: 1 },
            vrButton: { position: "top-right", order: 2 },
          }),
        ],
      })
    }
  })

  onCleanup(() => viewer?.destroy())

  return (
    <div class="w-full h-[60vh]" id="video360-player">
      <div id="view360-container" class="view360-container h-full w-full">
        <canvas class="view360-canvas" />
        <video
          src={asPreview(objStore.raw_url)}
          id="view360-video"
          playsinline
          crossOrigin="anonymous"
          style="display: none;"
        />
      </div>
    </div>
  )
}

export default Preview
