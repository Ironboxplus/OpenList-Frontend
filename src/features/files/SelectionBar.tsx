import { TbArchive, TbDots, TbDownload, TbLink, TbX } from "solid-icons/tb"
import { createEffect, createSignal, For, onCleanup, Show } from "solid-js"
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

/** Room one icon button takes in its group: min-w-10 and the divider. */
const OP_WIDTH = 41
/** gap-3 between the three groups. */
const GAP = 12

/**
 * The actions on the selection, which replace the search box in the top bar
 * while something is selected: close and count, then the operations the
 * context menu has too (operations.ts), then the rest under a menu. The bar
 * takes the room left in the top bar; operations that do not fit there move
 * to the top of the menu (as Cloudreve's bar does on a narrow window), so the
 * bar never runs under the top bar's own buttons.
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
  const shown = () => bar().filter((op) => op.visible())

  // How many operations fit inline; the rest go to the menu.
  const [fit, setFit] = createSignal(Infinity)
  const [root, setRoot] = createSignal<HTMLDivElement>()
  const [count, setCount] = createSignal<HTMLDivElement>()
  const [more, setMore] = createSignal<HTMLDivElement>()
  createEffect(() => {
    const el = root()
    const c = count()
    const m = more()
    if (!el || !c || !m || typeof ResizeObserver === "undefined") return
    const measure = () => {
      const room = el.clientWidth - c.offsetWidth - m.offsetWidth - 2 * GAP
      // 2: the operations group's own borders
      setFit(Math.max(0, Math.floor((room - 2) / OP_WIDTH)))
    }
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    ro.observe(c)
    onCleanup(() => ro.disconnect())
  })
  const inline = () => shown().slice(0, fit())
  const overflow = () => shown().slice(fit())

  return (
    <div
      ref={setRoot}
      data-selection-bar
      class="flex min-w-0 flex-1 items-center gap-3 overflow-hidden"
    >
      <ButtonGroup ref={setCount}>
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
      <Show when={inline().length > 0}>
        <ButtonGroup>
          <For each={inline()}>
            {(op) => (
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
            )}
          </For>
        </ButtonGroup>
      </Show>
      <ButtonGroup ref={setMore}>
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
            <For each={overflow()}>
              {(op) => (
                <DropdownMenuItem
                  data-action={op.name}
                  onSelect={op.run}
                  class={cn("gap-2", op.danger && "text-destructive")}
                >
                  <Dynamic component={op.icon} class="size-4" />
                  {tt(op.name)}
                </DropdownMenuItem>
              )}
            </For>
            <Show when={overflow().length > 0}>
              <DropdownMenuSeparator />
            </Show>
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
