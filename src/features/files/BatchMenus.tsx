import { Show } from "solid-js"
import { DropdownMenuItem } from "~/components/ui/dropdown-menu"
import { useCopyLink, useDownload, useT } from "~/hooks"
import { getSettingBool, me } from "~/store"
import { UserMethods } from "~/types"
import { runTool } from "./file-actions"

/** Download entries for the current selection (shared by the desktop bar and the phone sheet). */
export const DownloadItems = () => {
  const t = useT()
  const { batchDownloadSelected, sendToAria2, playlistDownloadSelected } =
    useDownload()
  const packaged = () =>
    UserMethods.is_admin(me()) || getSettingBool("package_download")
  return (
    <>
      <DropdownMenuItem onSelect={batchDownloadSelected}>
        {t("home.toolbar.batch_download")}
      </DropdownMenuItem>
      <Show when={packaged()}>
        <DropdownMenuItem onSelect={() => runTool("package_download")}>
          {t("home.toolbar.package_download")}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={playlistDownloadSelected}>
          {t("home.toolbar.playlist_download")}
        </DropdownMenuItem>
      </Show>
      <DropdownMenuItem onSelect={sendToAria2}>
        {t("home.toolbar.send_aria2")}
      </DropdownMenuItem>
    </>
  )
}

export const CopyLinkItems = () => {
  const t = useT()
  const {
    copySelectedPreviewPage,
    copySelectedRawLink,
    copySelectedMpvCommand,
    canCopyMpvCommand,
  } = useCopyLink()
  return (
    <>
      <DropdownMenuItem onSelect={() => copySelectedPreviewPage()}>
        {t("home.toolbar.preview_page")}
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={() => copySelectedRawLink()}>
        {t("home.toolbar.down_link")}
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={() => copySelectedRawLink(true)}>
        {t("home.toolbar.encode_down_link")}
      </DropdownMenuItem>
      <Show when={canCopyMpvCommand()}>
        <DropdownMenuItem onSelect={() => void copySelectedMpvCommand()}>
          {t("home.toolbar.mpv_command")}
        </DropdownMenuItem>
      </Show>
    </>
  )
}
