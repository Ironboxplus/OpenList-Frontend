import { TbUpload } from "solid-icons/tb"
import {
  createEffect,
  createSignal,
  onCleanup,
  onMount,
  type ParentProps,
} from "solid-js"
import { useRouter, useT } from "~/hooks"
import { MotionShow, MotionTokens } from "~/platform/motion"
import { draggingFiles, filesOfDrop } from "~/pages/home/uploads/drop"
import { requestUploadOf } from "~/pages/home/uploads/upload-intent"
import { notify } from "~/utils"
import { useFileAbilities } from "./file-actions"
import { bindFilesArea, unbindFilesArea } from "./files-motion"

const O = MotionTokens.options
const fade = {
  enter: [{ opacity: [0, 1] }, O.dragHint],
  exit: [{ opacity: [1, 0] }, O.dragHint],
} as const

/**
 * Where the folder's content shows: the live content, the layer its pictures
 * fade out in (files-motion.ts), and, while files are dragged in from outside
 * in any layout, a layer saying where they will go; dropping them opens the
 * upload with them (plan §P4, decided 11-27: the layer first, the dialog only
 * on the drop).
 */
export const FilesArea = (props: ParentProps) => {
  const t = useT()
  const can = useFileAbilities()
  const { pathname } = useRouter()
  let live!: HTMLDivElement
  let ghost!: HTMLDivElement
  onMount(() => bindFilesArea(live, ghost))
  onCleanup(() => unbindFilesArea(live))

  const [over, setOver] = createSignal(false)
  const dir = () => pathname().replace(/\/+$/, "").split("/").pop() || "/"
  const dragIn = (e: DragEvent) => {
    if (!draggingFiles(e) || !can.create()) return
    e.preventDefault()
    if (e.dataTransfer) e.dataTransfer.dropEffect = "copy"
    setOver(true)
  }
  // dropped elsewhere, or the drag given up (Escape, out of the window)
  createEffect(() => {
    if (!over()) return
    const off = () => setOver(false)
    window.addEventListener("drop", off)
    window.addEventListener("dragend", off)
    onCleanup(() => {
      window.removeEventListener("drop", off)
      window.removeEventListener("dragend", off)
    })
  })

  return (
    <div
      data-files-area
      class="relative w-full"
      onDragEnter={dragIn}
      onDragOver={dragIn}
    >
      {/* laid out as the card's VStack laid out these children before */}
      <div
        ref={live}
        data-motion="files-live"
        class="flex w-full flex-col items-center gap-y-2"
      >
        {props.children}
      </div>
      <div
        ref={ghost}
        data-files-ghost
        aria-hidden="true"
        inert
        class="pointer-events-none absolute inset-0"
      />
      <MotionShow
        when={over()}
        motion={fade}
        name="drop-overlay"
        class="absolute inset-0 z-20"
      >
        <div
          data-testid="drop-overlay"
          class="flex size-full justify-center rounded-lg border-2 border-dashed border-primary bg-primary/10"
          onDragOver={dragIn}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null))
              setOver(false)
          }}
          onDrop={async (e) => {
            e.preventDefault()
            e.stopPropagation()
            setOver(false)
            const files = await filesOfDrop(e.dataTransfer)
            if (files.length) requestUploadOf(files)
            else notify.warning(t("home.upload.no_files_drag"))
          }}
        >
          <div class="pointer-events-none sticky top-[35vh] flex h-fit items-center gap-2 py-16 text-base font-medium text-primary">
            <TbUpload class="size-5" aria-hidden="true" />
            {t("files.drop_to_upload", { dir: dir() })}
          </div>
        </div>
      </MotionShow>
    </div>
  )
}
