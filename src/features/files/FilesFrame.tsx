import type { ParentProps } from "solid-js"
import { cn } from "~/utils/cn"

/**
 * The one container of the Files page inside the shell. README, the list and
 * the footer all sit in it, so their left and right edges line up and the
 * margins are symmetric at every width.
 */
export const FilesFrame = (props: ParentProps<{ class?: string }>) => (
  <div
    data-files-frame
    class={cn("mx-auto w-full max-w-[1600px] px-3 sm:px-4", props.class)}
  >
    {props.children}
  </div>
)
