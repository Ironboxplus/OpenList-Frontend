import { TbDownload } from "solid-icons/tb"
import { Show } from "solid-js"
import { useDownload, useT } from "~/hooks"
import { downloadDenied, objStore } from "~/store"
import type { StoreObj } from "~/types"
import { pathJoin } from "~/utils"
import { dockPath } from "../viewer/state"

/** Whether this row's video is the one in the docked player. */
export const isPlaying = (name: string) =>
  !!dockPath() && dockPath() === pathJoin(objStore.listed || "/", name)

const stop = (e: Event) => e.stopPropagation()

/**
 * The row's own download button (plan §0.2 下载: every file downloads from the
 * list). It shows on hover and on focus; its clicks never reach the row, which
 * would open the file.
 */
export const RowDownload = (props: { obj: StoreObj }) => {
  const t = useT()
  const { downloadObjs } = useDownload()
  return (
    <Show when={!props.obj.is_dir && !downloadDenied()}>
      <button
        type="button"
        data-testid="row-download"
        aria-label={t("files.download")}
        title={t("files.download")}
        class="inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-transparent text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground focus-visible:opacity-100 group-hover/row:opacity-100"
        on:mousedown={stop}
        on:pointerdown={stop}
        on:click={(e: MouseEvent) => {
          e.preventDefault()
          e.stopPropagation()
          downloadObjs([props.obj])
        }}
      >
        <TbDownload class="size-4" />
      </button>
    </Show>
  )
}

/** "Playing" next to the name of the row the docked player plays. */
export const PlayingBadge = (props: { name: string }) => {
  const t = useT()
  return (
    <Show when={isPlaying(props.name)}>
      <span
        data-testid="playing-badge"
        class="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
      >
        {t("home.viewer.playing")}
      </span>
    </Show>
  )
}
