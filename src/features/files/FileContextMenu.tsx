import axios from "axios"
import type { IconTypes } from "solid-icons"
import {
  TbArchive,
  TbBooks,
  TbDots,
  TbDownload,
  TbExternalLink,
  TbLink,
  TbMovie,
  TbPlayerPlay,
  TbSeeding,
  TbTerminal2,
  TbApps,
} from "solid-icons/tb"
import { createMemo, For, type ParentProps, Show } from "solid-js"
import { Dynamic } from "solid-js/web"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "~/components/ui/context-menu"
import { useCopyLink, useLink, useRouter, useT } from "~/hooks"
import {
  haveSelected,
  me,
  objStore,
  oneChecked,
  selectedObjs,
  userCan,
} from "~/store"
import { isArchive } from "~/store/archive"
import { ObjType, UserMethods } from "~/types"
import { bus, convertURL, isMpvMedia, notify, torrentParse } from "~/utils"
import { pathJoin } from "~/utils/path"
import {
  useFileOperations,
  type FileOperation,
} from "~/pages/home/toolbar/operations"
import { getPreviews } from "~/pages/home/previews"
import { players } from "~/pages/home/previews/video_box"
import {
  isLibraryPath,
  mediaReady,
  openMediaEditor,
  toggleLibrary,
} from "../media/state"
import { CopyLinkItems, DownloadItems } from "./BatchMenus"
import { selectionMode } from "./selection-mode"
import { phoneShell } from "../shell/topbar-slot"

const Entry = (props: {
  icon: IconTypes
  label: string
  danger?: boolean
  onSelect: () => void
  name?: string
}) => (
  <ContextMenuItem
    data-action={props.name}
    onSelect={props.onSelect}
    class={props.danger ? "gap-3 text-destructive" : "gap-3"}
  >
    <Dynamic component={props.icon} class="size-4 shrink-0" />
    {props.label}
  </ContextMenuItem>
)

const OpEntry = (props: { op: FileOperation }) => {
  const t = useT()
  return (
    <Show when={props.op.visible()}>
      <Entry
        name={props.op.name}
        icon={props.op.icon}
        danger={props.op.danger}
        label={t(`home.toolbar.${props.op.name}`)}
        onSelect={props.op.run}
      />
    </Show>
  )
}

const SubEntry = (props: ParentProps<{ icon: IconTypes; label: string }>) => (
  <ContextMenuSub>
    <ContextMenuSubTrigger class="gap-3">
      <Dynamic component={props.icon} class="size-4 shrink-0" />
      {props.label}
    </ContextMenuSubTrigger>
    <ContextMenuSubContent>{props.children}</ContextMenuSubContent>
  </ContextMenuSub>
)

/**
 * Right-click menu of the file list (Cloudreve's layout: open, share and edit,
 * more, delete, in groups). It wraps the list; the rows select themselves on
 * the right click, and the menu is for whatever is selected then. The common
 * actions are the ones of the selection bar (operations.ts).
 */
export const FileContextMenu = (props: ParentProps) => {
  const t = useT()
  const ops = useFileOperations()
  const { rawLink } = useLink()
  const { isShare, pathname, pushHref, to } = useRouter()
  const { copyMpvCommand } = useCopyLink()
  const only = () =>
    selectedObjs().length === 1 ? selectedObjs()[0] : undefined
  const tt = (key: string) => t(`home.toolbar.${key}`)
  const writable = () => !isShare() && objStore.write
  const openWithPreviews = createMemo(() => {
    const obj = only()
    if (!obj || obj.is_dir) return []
    return getPreviews({ ...obj, provider: objStore.provider })
  })

  const canSeed = () =>
    !isShare() && haveSelected() && !selectedObjs().some((o) => o.is_dir)
  const canDecompress = () =>
    writable() &&
    userCan("decompress") &&
    selectedObjs().every((o) => !o.is_dir && isArchive(o.name))
  const canTorrent = () =>
    writable() &&
    userCan("offline_download") &&
    !!only() &&
    !only()!.is_dir &&
    only()!.name.toLowerCase().endsWith(".torrent")
  const canMedia = () => UserMethods.is_admin(me()) && mediaReady()
  const folderPath = () => {
    const obj = only()
    return obj ? pathJoin(pathname(), obj.name) : ""
  }
  const isVideo = () => only()?.type === ObjType.VIDEO

  const openTorrent = async () => {
    const obj = only()
    if (!obj) return
    try {
      // fetch the torrent and hand its parsed content to the offline download dialog
      const resp = await axios.get(rawLink(obj, false), {
        responseType: "arraybuffer",
      })
      const bytes = new Uint8Array(resp.data as ArrayBuffer)
      let binary = ""
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i])
      }
      const base64Data = btoa(binary)
      const parseResp = await torrentParse(base64Data)
      if (parseResp.code === 200) {
        bus.emit("torrent_parsed", {
          torrentData: base64Data,
          info: parseResp.data,
        })
      } else {
        notify.error(parseResp.message || "解析 torrent 失败")
      }
    } catch (err) {
      notify.error(`解析 torrent 失败: ${err}`)
    }
  }

  const hasMore = () =>
    canSeed() ||
    canDecompress() ||
    canTorrent() ||
    (canMedia() && !!only()) ||
    isVideo() ||
    (!!only() && isMpvMedia(only()!))
  const hasFirst = () =>
    ops.open.visible() ||
    openWithPreviews().length > 0 ||
    ops.download.visible()

  return (
    <ContextMenu>
      <ContextMenuTrigger
        as="div"
        class="contents"
        // On a phone the long press selects; it must not open the menu too.
        disabled={phoneShell() || selectionMode()}
        // Only the rows have a menu; elsewhere the browser's own is suppressed.
        onContextMenu={(e: MouseEvent) => {
          if (!(e.target as Element).closest(".viselect-item")) {
            e.preventDefault()
          }
        }}
      >
        {props.children}
      </ContextMenuTrigger>
      <ContextMenuContent>
        <Show when={haveSelected()}>
          <Show when={hasFirst()}>
            <OpEntry op={ops.open} />
            <Show when={openWithPreviews().length > 0}>
              <SubEntry icon={TbApps} label={tt("open_with")}>
                <For each={openWithPreviews()}>
                  {(preview) => (
                    <ContextMenuItem
                      onSelect={() => {
                        const obj = only()
                        if (obj) {
                          to(`${pushHref(obj.name)}?preview=${preview.key}`)
                        }
                      }}
                    >
                      {preview.name}
                    </ContextMenuItem>
                  )}
                </For>
              </SubEntry>
            </Show>
            <OpEntry op={ops.download} />
            <ContextMenuSeparator />
          </Show>
          <OpEntry op={ops.share} />
          <OpEntry op={ops.rename} />
          <OpEntry op={ops.copy} />
          <OpEntry op={ops.move} />
          <SubEntry icon={TbLink} label={tt("copy_link")}>
            <CopyLinkItems />
          </SubEntry>
          <Show when={hasMore()}>
            <ContextMenuSeparator />
            <SubEntry icon={TbDots} label={t("files.more_actions")}>
              <Show when={canDecompress()}>
                <Entry
                  icon={TbArchive}
                  label={tt("decompress")}
                  onSelect={() => bus.emit("tool", "decompress")}
                />
              </Show>
              <Show when={canSeed()}>
                <Entry
                  icon={TbSeeding}
                  label={tt("generate_transfer_seed")}
                  onSelect={() =>
                    bus.emit("generate_transfer_seed", {
                      paths: selectedObjs().map((obj) =>
                        pathJoin(pathname(), obj.name),
                      ),
                    })
                  }
                />
              </Show>
              <Show when={canTorrent()}>
                <Entry
                  icon={TbDownload}
                  label={tt("offline_download_torrent")}
                  onSelect={() => void openTorrent()}
                />
              </Show>
              <Show when={canMedia() && oneChecked() && objStore.obj}>
                <Entry
                  icon={TbMovie}
                  label={t("media.menu_item")}
                  onSelect={() => openMediaEditor(folderPath())}
                />
                <Show when={only()?.is_dir}>
                  <Show
                    when={isLibraryPath(folderPath())}
                    fallback={
                      <Entry
                        icon={TbBooks}
                        label={t("media.library.set")}
                        onSelect={() => void toggleLibrary(folderPath(), false)}
                      />
                    }
                  >
                    <Entry
                      icon={TbBooks}
                      label={t("media.library.unset")}
                      onSelect={() => void toggleLibrary(folderPath(), true)}
                    />
                  </Show>
                </Show>
              </Show>
              <Show when={isVideo()}>
                <SubEntry
                  icon={TbPlayerPlay}
                  label={t("home.preview.play_with")}
                >
                  <For each={players}>
                    {(player) => (
                      <ContextMenuItem
                        class="gap-3"
                        onSelect={() => {
                          const obj = only()
                          if (!obj) return
                          window.open(
                            convertURL(player.scheme, {
                              raw_url: "",
                              name: obj.name,
                              d_url: rawLink(obj, true),
                            }),
                            "_self",
                          )
                        }}
                      >
                        <img
                          class="size-4 shrink-0"
                          src={`${window.__dynamic_base__}/images/${player.icon}.webp`}
                          alt=""
                        />
                        {player.name}
                      </ContextMenuItem>
                    )}
                  </For>
                </SubEntry>
              </Show>
              <Show when={only() && isMpvMedia(only()!)}>
                <Entry
                  icon={TbTerminal2}
                  label={tt("mpv_command")}
                  onSelect={() => void copyMpvCommand(only()!)}
                />
              </Show>
              <SubEntry icon={TbDownload} label={t("files.download")}>
                <DownloadItems />
              </SubEntry>
            </SubEntry>
          </Show>
          <Show when={ops.delete.visible()}>
            <ContextMenuSeparator />
            <OpEntry op={ops.delete} />
          </Show>
        </Show>
      </ContextMenuContent>
    </ContextMenu>
  )
}
