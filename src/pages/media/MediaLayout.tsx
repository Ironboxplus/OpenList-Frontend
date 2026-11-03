import { JSX } from "solid-js"
import { playerState } from "./music/player"
import { useTitle } from "~/hooks"
import { getSetting } from "~/store"

interface MediaLayoutProps {
  children: JSX.Element
  title: string
}

/** The body of one library: panel background, the shell's 16px gutter, room for the mini player. */
export const MediaLayout = (props: MediaLayoutProps) => {
  // 设置浏览器标签页 title，复用 OpenList 原有的 title 逻辑
  useTitle(() => `${props.title} | ${getSetting("site_title")}`)

  return (
    <div class="flex min-w-0 flex-1 flex-col">
      <div
        class="flex-1 p-4 transition-[padding] duration-300"
        style={{
          "padding-bottom": playerState().playlist.length > 0 ? "91px" : "16px",
        }}
      >
        {props.children}
      </div>
    </div>
  )
}
