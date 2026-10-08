import {
  TbArchive,
  TbCheckbox,
  TbCopy,
  TbDots,
  TbDownload,
  TbEdit,
  TbFileArrowRight,
  TbFilePlus,
  TbFolderPlus,
  TbLink,
  TbMagnet,
  TbRefresh,
  TbSettings,
  TbShare,
  TbTrash,
  TbUpload,
  TbX,
} from "solid-icons/tb"
import type { IconTypes } from "solid-icons"
import { Show } from "solid-js"
import { Dynamic } from "solid-js/web"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { focusRing } from "~/components/ui/focus"
import { usePath, useRouter, useT } from "~/hooks"
import { UserMethods } from "~/types"
import { invalidateMedia, mediaReady, openMediaEditor } from "../media/state"
import { isTocVisible, setTocDisabled } from "~/components"
import {
  haveSelected,
  me,
  selectAll,
  selectedObjs,
  toggleCheckbox,
} from "~/store"
import { cn } from "~/utils/cn"
import { CopyLinkItems, DownloadItems } from "./BatchMenus"
import { runTool, useFileAbilities, type ToolName } from "./file-actions"

const barButton = cn(
  focusRing,
  "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md bg-transparent px-2 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-40",
)

const ActionButton = (props: {
  icon: IconTypes
  label: string
  onClick: () => void
  danger?: boolean
  name: string
}) => (
  <button
    type="button"
    data-action={props.name}
    aria-label={props.label}
    title={props.label}
    onClick={props.onClick}
    class={cn(barButton, props.danger && "text-destructive")}
  >
    <Dynamic component={props.icon} class="size-4" />
    {/* Labels need room: icon-only below the desktop tier. */}
    <span class="hidden lg:inline">{props.label}</span>
  </button>
)

const tool = (name: ToolName) => () => runTool(name)

/**
 * The strip above the file list on tablet and desktop. It replaces the old
 * floating toolbars: create/upload/offline on the left and refresh/settings on
 * the right, turning into the batch bar while something is selected. Every
 * button is an entry to the same bus tool the old toolbar emitted.
 */
export const ActionBar = () => {
  const t = useT()
  const can = useFileAbilities()
  const { refresh } = usePath()
  const { pathname } = useRouter()
  const tt = (key: string) => t(`home.toolbar.${key}`)
  return (
    <div
      data-files-actionbar
      class="sticky z-[5] flex h-11 w-full items-center gap-1 border-b bg-card px-2 text-card-foreground"
      style={{ top: "var(--shell-top)" }}
    >
      <Show
        when={haveSelected()}
        fallback={
          <>
            <Show when={can.create()}>
              <ActionButton
                name="upload"
                icon={TbUpload}
                label={tt("upload")}
                onClick={tool("upload")}
              />
              <ActionButton
                name="mkdir"
                icon={TbFolderPlus}
                label={tt("mkdir")}
                onClick={tool("mkdir")}
              />
              <ActionButton
                name="new_file"
                icon={TbFilePlus}
                label={tt("new_file")}
                onClick={tool("new_file")}
              />
            </Show>
            <Show when={can.offline()}>
              <ActionButton
                name="offline_download"
                icon={TbMagnet}
                label={tt("offline_download")}
                onClick={tool("offline_download")}
              />
            </Show>
            <div class="flex-1" />
            <ActionButton
              name="refresh"
              icon={TbRefresh}
              label={tt("refresh")}
              onClick={() => {
                invalidateMedia(pathname())
                void refresh(undefined, true)
              }}
            />
            <ActionButton
              name="local_settings"
              icon={TbSettings}
              label={tt("local_settings")}
              onClick={tool("local_settings")}
            />
            <DropdownMenu placement="bottom-end">
              <DropdownMenuTrigger
                aria-label={tt("more")}
                data-action="more"
                class={barButton}
              >
                <TbDots class="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <Show when={can.move()}>
                  <DropdownMenuItem onSelect={tool("recursiveMove")}>
                    {tt("recursive_move")}
                  </DropdownMenuItem>
                </Show>
                <Show when={can.remove()}>
                  <DropdownMenuItem onSelect={tool("removeEmptyDirectory")}>
                    {tt("remove_empty_directory")}
                  </DropdownMenuItem>
                </Show>
                <Show when={can.rename()}>
                  <DropdownMenuItem
                    onSelect={() => {
                      selectAll(true)
                      runTool("batchRename")
                    }}
                  >
                    {tt("batch_rename")}
                  </DropdownMenuItem>
                </Show>
                <Show when={isTocVisible()}>
                  <DropdownMenuItem onSelect={() => setTocDisabled((d) => !d)}>
                    {tt("toggle_markdown_toc")}
                  </DropdownMenuItem>
                </Show>
                <Show when={UserMethods.is_admin(me()) && mediaReady()}>
                  <DropdownMenuItem
                    data-media-info
                    onSelect={() => openMediaEditor(pathname())}
                  >
                    {t("media.menu_item")}
                  </DropdownMenuItem>
                </Show>
                <DropdownMenuItem onSelect={toggleCheckbox} class="gap-2">
                  <TbCheckbox class="size-4" />
                  {tt("toggle_checkbox")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      >
        <span
          data-selected-count
          class="mr-1 inline-flex min-w-6 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground"
        >
          {selectedObjs().length}
        </span>
        <span class="mr-2 whitespace-nowrap text-sm text-muted-foreground">
          {t("files.selected_n", { n: selectedObjs().length })}
        </span>
        <Show when={can.copy()}>
          <ActionButton
            name="copy"
            icon={TbCopy}
            label={tt("copy")}
            onClick={tool("copy")}
          />
        </Show>
        <Show when={can.move()}>
          <ActionButton
            name="move"
            icon={TbFileArrowRight}
            label={tt("move")}
            onClick={tool("move")}
          />
        </Show>
        <Show when={can.rename()}>
          <ActionButton
            name="rename"
            icon={TbEdit}
            label={tt("rename")}
            onClick={tool("rename")}
          />
        </Show>
        <Show when={can.remove()}>
          <ActionButton
            name="delete"
            icon={TbTrash}
            label={tt("delete")}
            danger
            onClick={tool("delete")}
          />
        </Show>
        <DropdownMenu placement="bottom-start">
          <DropdownMenuTrigger
            aria-label={t("files.download")}
            data-action="download"
            class={barButton}
          >
            <TbDownload class="size-4" />
            <span class="hidden lg:inline">{t("files.download")}</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DownloadItems />
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu placement="bottom-start">
          <DropdownMenuTrigger
            aria-label={tt("more")}
            data-action="batch-more"
            class={barButton}
          >
            <TbDots class="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <Show when={can.decompress()}>
              <DropdownMenuItem onSelect={tool("decompress")} class="gap-2">
                <TbArchive class="size-4" />
                {tt("decompress")}
              </DropdownMenuItem>
            </Show>
            <Show when={can.share()}>
              <DropdownMenuItem onSelect={tool("share")} class="gap-2">
                <TbShare class="size-4" />
                {tt("share")}
              </DropdownMenuItem>
            </Show>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger class="gap-2">
                <TbLink class="size-4" />
                {tt("copy_link")}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <CopyLinkItems />
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>
        <div class="flex-1" />
        <ActionButton
          name="cancel_select"
          icon={TbX}
          label={tt("cancel_select")}
          onClick={() => selectAll(false)}
        />
      </Show>
    </div>
  )
}
