// What a file without a preview shows where a preview would be: its icon,
// name, size and time, and its download. The "download" entry of getPreviews
// (previews/index.ts) for the places that still pick a preview inside a page,
// the files inside an archive; the file list itself opens such a file in the
// small dialog (UnknownDialog). Replaces the download page (previews/download.tsx,
// removed in P2).
import { TbDownload, TbLink } from "solid-icons/tb"
import { Show } from "solid-js"
import { Dynamic } from "solid-js/web"
import { Button } from "~/components/ui/button"
import { useT, useUtil } from "~/hooks"
import { downloadDenied, getMainColor, objStore, previewDenied } from "~/store"
import { formatDate, getFileSize } from "~/utils"
import { getIconByObj } from "~/utils/icon"
import { saveFile } from "~/hooks/useDownload"

export const FileFacts = () => {
  const t = useT()
  return (
    <div class="text-sm text-muted-foreground">
      {[
        getFileSize(objStore.obj.size),
        formatDate(objStore.obj.modified),
        objStore.provider ? t(`drivers.drivers.${objStore.provider}`) : "",
      ]
        .filter(Boolean)
        .join("  ·  ")}
    </div>
  )
}

const FileSummary = () => {
  const t = useT()
  const { copy } = useUtil()
  return (
    <div class="flex w-full flex-col items-center gap-4 py-6 text-center">
      <Dynamic
        component={getIconByObj(objStore.obj)}
        class="size-16"
        style={{ color: getMainColor() }}
      />
      <div class="flex flex-col items-center gap-1">
        <div class="break-all text-lg font-semibold">{objStore.obj.name}</div>
        <FileFacts />
      </div>
      <Show when={previewDenied()}>
        <p class="text-sm text-muted-foreground">
          {t("shares.preview_disabled")}
        </p>
      </Show>
      <Show
        when={!downloadDenied()}
        fallback={
          <p class="text-sm text-muted-foreground">
            {t("shares.download_disabled")}
          </p>
        }
      >
        <div class="flex gap-2">
          <Button
            variant="outline"
            class="gap-2"
            onClick={() => copy(objStore.raw_url)}
          >
            <TbLink class="size-4" />
            {t("home.viewer.copy_link")}
          </Button>
          <Button
            class="gap-2"
            onClick={() => saveFile(objStore.raw_url, objStore.obj.name)}
          >
            <TbDownload class="size-4" />
            {t("home.preview.download")}
          </Button>
        </div>
      </Show>
    </div>
  )
}

export default FileSummary
