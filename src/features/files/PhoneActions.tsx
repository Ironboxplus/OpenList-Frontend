import {
  TbCopy,
  TbDots,
  TbFileArrowRight,
  TbFilePlus,
  TbFolderPlus,
  TbLink,
  TbMagnet,
  TbPlus,
  TbTrash,
  TbUpload,
  TbX,
} from "solid-icons/tb"
import type { IconTypes } from "solid-icons"
import { createSignal, For, Show } from "solid-js"
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet"
import { useT } from "~/hooks"
import { selectAll, selectedObjs } from "~/store"
import { cn } from "~/utils/cn"
import { TAB_BAR_HEIGHT } from "../shell/viewport"
import { CopyLinkItems, DownloadItems } from "./BatchMenus"
import { runTool, useFileAbilities, type ToolName } from "./file-actions"
import { cancelSelection } from "./selection-mode"
import { FolderSortMenu } from "./SortMenu"

const sheetRow =
  focusRing +
  " flex h-12 w-full items-center gap-3 rounded-lg bg-transparent px-3 text-left text-sm text-foreground hover:bg-accent"

/**
 * Phone: a floating + above the tab bar. It opens a sheet with the create
 * actions, so the list keeps the whole screen.
 */
export const PhoneFab = () => {
  const t = useT()
  const can = useFileAbilities()
  const [open, setOpen] = createSignal(false)
  const entries = (): { name: ToolName; icon: IconTypes; label: string }[] => [
    ...(can.create()
      ? [
          { name: "upload" as const, icon: TbUpload, label: "upload" },
          { name: "mkdir" as const, icon: TbFolderPlus, label: "mkdir" },
          { name: "new_file" as const, icon: TbFilePlus, label: "new_file" },
        ]
      : []),
    ...(can.offline()
      ? [
          {
            name: "offline_download" as const,
            icon: TbMagnet,
            label: "offline_download",
          },
        ]
      : []),
  ]
  return (
    <Show when={entries().length > 0}>
      <button
        type="button"
        data-files-fab
        aria-label={t("files.create")}
        onClick={() => setOpen(true)}
        class={cn(
          focusRing,
          "fixed right-4 z-[1150] inline-flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform active:scale-95",
        )}
        style={{
          bottom: `calc(${TAB_BAR_HEIGHT} + env(safe-area-inset-bottom) + 1rem)`,
        }}
      >
        <TbPlus class="size-6" />
      </button>
      <Sheet open={open()} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          class="rounded-t-xl"
          style={{
            "padding-bottom": "calc(2rem + env(safe-area-inset-bottom))",
          }}
        >
          <SheetHeader>
            <SheetTitle>{t("files.create")}</SheetTitle>
          </SheetHeader>
          <div class="mt-3 flex flex-col gap-1">
            <For each={entries()}>
              {(e) => (
                <button
                  type="button"
                  data-fab-action={e.name}
                  class={sheetRow}
                  onClick={() => {
                    setOpen(false)
                    runTool(e.name)
                  }}
                >
                  <Dynamic component={e.icon} class="size-5" />
                  {t(`home.toolbar.${e.label}`)}
                </button>
              )}
            </For>
            <FolderSortMenu class={sheetRow} placement="bottom-start" />
          </div>
        </SheetContent>
      </Sheet>
    </Show>
  )
}

/** Top bar content while the phone is in selection mode: count + cancel. */
export const PhoneSelectionHeader = () => {
  const t = useT()
  return (
    <div class="flex min-w-0 items-center gap-1" data-selection-header>
      <button
        type="button"
        data-selection-cancel
        aria-label={t("home.toolbar.cancel_select")}
        onClick={cancelSelection}
        class={cn(
          focusRing,
          "inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-transparent text-foreground hover:bg-accent",
        )}
      >
        <TbX class="size-5" />
      </button>
      <span class="truncate text-sm font-medium">
        {t("files.selected_n", { n: selectedObjs().length })}
      </span>
    </div>
  )
}

const batchButton =
  focusRing +
  " flex flex-1 flex-col items-center justify-center gap-0.5 bg-transparent text-[11px] font-medium text-foreground"

/** Replaces the tab bar in selection mode: copy, move, delete, more. */
export const PhoneBatchBar = () => {
  const t = useT()
  const can = useFileAbilities()
  const tt = (key: string) => t(`home.toolbar.${key}`)
  const Btn = (p: {
    name: string
    icon: IconTypes
    label: string
    tool: ToolName
    danger?: boolean
  }) => (
    <button
      type="button"
      data-batch={p.name}
      class={cn(batchButton, p.danger && "text-destructive")}
      onClick={() => runTool(p.tool)}
    >
      <Dynamic component={p.icon} class="size-5" />
      {p.label}
    </button>
  )
  return (
    <nav
      aria-label="batch"
      data-batch-bar
      class="fixed inset-x-0 bottom-0 z-[1200] flex border-t bg-card text-card-foreground"
      style={{
        height: `calc(${TAB_BAR_HEIGHT} + env(safe-area-inset-bottom))`,
        "padding-bottom": "env(safe-area-inset-bottom)",
      }}
    >
      <Show when={can.copy()}>
        <Btn name="copy" icon={TbCopy} label={tt("copy")} tool="copy" />
      </Show>
      <Show when={can.move()}>
        <Btn
          name="move"
          icon={TbFileArrowRight}
          label={tt("move")}
          tool="move"
        />
      </Show>
      <Show when={can.remove()}>
        <Btn
          name="delete"
          icon={TbTrash}
          label={tt("delete")}
          tool="delete"
          danger
        />
      </Show>
      <DropdownMenu placement="top">
        <DropdownMenuTrigger data-batch="more" class={batchButton}>
          <TbDots class="size-5" />
          {tt("more")}
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={() => selectAll(true)}>
            {t("files.select_all")}
          </DropdownMenuItem>
          <Show when={can.rename()}>
            <DropdownMenuItem onSelect={() => runTool("rename")}>
              {tt("rename")}
            </DropdownMenuItem>
          </Show>
          <Show when={can.decompress()}>
            <DropdownMenuItem onSelect={() => runTool("decompress")}>
              {tt("decompress")}
            </DropdownMenuItem>
          </Show>
          <Show when={can.share()}>
            <DropdownMenuItem onSelect={() => runTool("share")}>
              {tt("share")}
            </DropdownMenuItem>
          </Show>
          <DropdownMenuSeparator />
          <DownloadItems />
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
    </nav>
  )
}
