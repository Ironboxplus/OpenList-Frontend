import { TbArchive, TbDots, TbDownload, TbLink, TbX } from "solid-icons/tb"
import { For, Show } from "solid-js"
import { Dynamic } from "solid-js/web"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { useT } from "~/hooks"
import { selectAll, selectedObjs } from "~/store"
import {
  useFileOperations,
  type FileOperation,
} from "~/pages/home/toolbar/operations"
import { cn } from "~/utils/cn"
import { CopyLinkItems, DownloadItems } from "./BatchMenus"
import { ButtonGroup, groupButton } from "./ButtonGroup"
import { runTool, useFileAbilities } from "./file-actions"

/**
 * The actions on the selection, which replace the search box in the top bar
 * while something is selected: close and count, then the operations the
 * context menu has too (operations.ts), then the rest under a menu.
 */
export const SelectionBar = () => {
  const t = useT()
  const ops = useFileOperations()
  const can = useFileAbilities()
  const tt = (key: string) => t(`home.toolbar.${key}`)
  const bar = (): FileOperation[] => [
    ops.open,
    ops.download,
    ops.copy,
    ops.move,
    ops.rename,
    ops.share,
    ops.delete,
  ]
  return (
    <div data-selection-bar class="flex min-w-0 items-center gap-3">
      <ButtonGroup>
        <button
          type="button"
          data-action="cancel_select"
          aria-label={tt("cancel_select")}
          title={tt("cancel_select")}
          onClick={() => selectAll(false)}
          class={groupButton}
        >
          <TbX class="size-4" />
        </button>
        <span
          data-selected-count
          class="inline-flex items-center whitespace-nowrap px-3 text-sm"
        >
          {t("files.selected_n", { n: selectedObjs().length })}
        </span>
      </ButtonGroup>
      <ButtonGroup>
        <For each={bar()}>
          {(op) => (
            <Show when={op.visible()}>
              <button
                type="button"
                data-action={op.name}
                aria-label={tt(op.name)}
                title={tt(op.name)}
                onClick={op.run}
                class={cn(groupButton, op.danger && "text-destructive")}
              >
                <Dynamic component={op.icon} class="size-4" />
              </button>
            </Show>
          )}
        </For>
      </ButtonGroup>
      <ButtonGroup>
        <DropdownMenu placement="bottom-start">
          <DropdownMenuTrigger
            aria-label={t("files.more_actions")}
            title={t("files.more_actions")}
            data-action="batch-more"
            class={groupButton}
          >
            <TbDots class="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onSelect={() => selectAll(true)}>
              {t("files.select_all")}
            </DropdownMenuItem>
            <Show when={can.decompress()}>
              <DropdownMenuItem
                onSelect={() => runTool("decompress")}
                class="gap-2"
              >
                <TbArchive class="size-4" />
                {tt("decompress")}
              </DropdownMenuItem>
            </Show>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger class="gap-2">
                <TbDownload class="size-4" />
                {t("files.download")}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DownloadItems />
              </DropdownMenuSubContent>
            </DropdownMenuSub>
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
      </ButtonGroup>
    </div>
  )
}
