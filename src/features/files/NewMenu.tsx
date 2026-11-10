import {
  TbFilePlus,
  TbFolderPlus,
  TbFolderUp,
  TbMagnet,
  TbPlus,
  TbUpload,
} from "solid-icons/tb"
import { Show } from "solid-js"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { focusRing } from "~/components/ui/focus"
import { useT } from "~/hooks"
import { requestUpload } from "~/pages/home/uploads/upload-intent"
import { cn } from "~/utils/cn"
import { runTool, useFileAbilities } from "./file-actions"

/**
 * What can be created in the current folder: upload files / a folder, a new
 * folder or file, an offline download. The New menu and the last breadcrumb's
 * menu both list these.
 */
export const FolderActionItems = () => {
  const t = useT()
  const can = useFileAbilities()
  const tt = (key: string) => t(`home.toolbar.${key}`)
  return (
    <>
      <Show when={can.create()}>
        <DropdownMenuItem
          data-action="upload"
          onSelect={() => requestUpload("file")}
          class="gap-2"
        >
          <TbUpload class="size-4" />
          {t("files.upload_file")}
        </DropdownMenuItem>
        <DropdownMenuItem
          data-action="upload_folder"
          onSelect={() => requestUpload("folder")}
          class="gap-2"
        >
          <TbFolderUp class="size-4" />
          {t("files.upload_folder")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          data-action="mkdir"
          onSelect={() => runTool("mkdir")}
          class="gap-2"
        >
          <TbFolderPlus class="size-4" />
          {tt("mkdir")}
        </DropdownMenuItem>
        <DropdownMenuItem
          data-action="new_file"
          onSelect={() => runTool("new_file")}
          class="gap-2"
        >
          <TbFilePlus class="size-4" />
          {tt("new_file")}
        </DropdownMenuItem>
      </Show>
      <Show when={can.offline()}>
        <Show when={can.create()}>
          <DropdownMenuSeparator />
        </Show>
        <DropdownMenuItem
          data-action="offline_download"
          onSelect={() => runTool("offline_download")}
          class="gap-2"
        >
          <TbMagnet class="size-4" />
          {tt("offline_download")}
        </DropdownMenuItem>
      </Show>
    </>
  )
}

/** The primary button of the top bar: a menu of what can be created here. */
export const NewMenu = () => {
  const t = useT()
  const can = useFileAbilities()
  return (
    <Show when={can.create() || can.offline()}>
      <DropdownMenu placement="bottom-start">
        <DropdownMenuTrigger
          data-files-new
          class={cn(
            focusRing,
            "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90",
          )}
        >
          <TbPlus class="size-5" />
          {t("files.create")}
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <FolderActionItems />
        </DropdownMenuContent>
      </DropdownMenu>
    </Show>
  )
}
