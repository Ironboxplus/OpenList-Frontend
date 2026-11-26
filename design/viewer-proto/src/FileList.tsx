// The directory, which is also the playlist of the docked player (§0 视频):
// the playing row is marked, a click on another video switches. Every file
// can be downloaded from here in one click (§0 下载): the row's own button,
// the context menu, and the selection bar.
import { Dynamic } from "solid-js/web"
import { For, Show, createMemo, createSignal } from "solid-js"
import { Transition } from "solid-transition-group"
import { TbCheck, TbChartBar, TbDownload, TbShare, TbX } from "solid-icons/tb"
import { Button } from "~/components/ui/button"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "~/components/ui/context-menu"
import { cn } from "~/utils/cn"
import { getIconByObj } from "~/utils/icon"
import { copyText, download, linkOf, type Entry } from "./files"
import { reducedMotion, run } from "./motion"
import {
  dir,
  dockPath,
  entryAt,
  openEntry,
  selected,
  setSelected,
  setShareFor,
  toggleSelected,
} from "./state"
import { IconButton, MENU_MOTION, formatSize, formatTime, isPhone } from "./ui"

const rowOf = (t: EventTarget | null) =>
  t instanceof Element ? t.closest<HTMLElement>("[data-path]") : null

export const FileList = () => {
  const [menuFor, setMenuFor] = createSignal<Entry | undefined>()
  const [menuOpen, setMenuOpen] = createSignal(false)
  const entries = () => dir()?.entries ?? []
  const chosen = createMemo(() =>
    entries().filter((e) => selected().has(e.path)),
  )
  // the menu acts on the selection when the row is part of it
  const menuTargets = () => {
    const m = menuFor()
    if (!m) return []
    return selected().has(m.path) ? chosen() : [m]
  }
  const files = (list: Entry[]) => list.filter((e) => !e.is_dir)

  const downloadAll = (list: Entry[]) => {
    for (const e of files(list)) download(e)
  }

  const onRowClick = (e: MouseEvent, entry: Entry) => {
    if (menuOpen()) return
    if (e.ctrlKey || e.metaKey || selected().size > 0) {
      toggleSelected(entry.path)
      return
    }
    const row = e.currentTarget as HTMLElement
    openEntry(entry, "list", row.querySelector("[data-origin]") ?? row)
  }

  return (
    <div data-testid="file-list">
      <Show when={!isPhone()}>
        <div
          role="row"
          class="sticky top-(--proto-bar) z-10 grid grid-cols-[2.5rem_1fr_6rem_10rem_3rem] items-center gap-3 border-b bg-(--files-card-bg) px-4 py-2 text-xs text-muted-foreground"
        >
          <span />
          <span>名称</span>
          <span class="text-right">大小</span>
          <span>修改时间</span>
          <span />
        </div>
      </Show>
      <ContextMenu onOpenChange={setMenuOpen}>
        <ContextMenuTrigger
          as="div"
          role="list"
          onContextMenu={(e: MouseEvent) =>
            setMenuFor(entryAt(rowOf(e.target)?.dataset.path))
          }
          onPointerDown={(e: PointerEvent) =>
            setMenuFor(entryAt(rowOf(e.target)?.dataset.path))
          }
        >
          <For each={entries()}>
            {(entry) => {
              const playing = () => dockPath() === entry.path
              const isSel = () => selected().has(entry.path)
              return (
                <div
                  role="listitem"
                  tabIndex={0}
                  data-path={entry.path}
                  data-kind={entry.kind}
                  data-testid="row"
                  aria-current={playing() ? "true" : undefined}
                  class={cn(
                    "group relative grid cursor-default items-center gap-3 border-b border-border/60 px-4 outline-none transition-colors hover:bg-accent/60 focus-visible:bg-accent",
                    isPhone()
                      ? "grid-cols-[2.5rem_1fr_2.5rem] py-2"
                      : "grid-cols-[2.5rem_1fr_6rem_10rem_3rem] py-1.5",
                    isSel() && "bg-primary/10 hover:bg-primary/15",
                    playing() && "bg-primary/10",
                  )}
                  onClick={(e) => onRowClick(e, entry)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter")
                      openEntry(entry, "list", e.currentTarget)
                  }}
                >
                  {/* the playing row: a bar on the left edge and a label, not colour alone */}
                  <Show when={playing()}>
                    <span class="absolute inset-y-0 left-0 w-[3px] bg-primary" />
                  </Show>
                  <button
                    type="button"
                    aria-label={
                      isSel() ? `取消选择 ${entry.name}` : `选择 ${entry.name}`
                    }
                    aria-pressed={isSel()}
                    class="relative flex size-10 items-center justify-center rounded-md outline-none focus-visible:ring-[1.5px] focus-visible:ring-ring"
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleSelected(entry.path)
                    }}
                  >
                    <Show
                      when={entry.kind === "image" && entry.thumb}
                      fallback={
                        <span
                          data-origin
                          class="flex size-10 items-center justify-center"
                        >
                          <Dynamic
                            component={getIconByObj(entry)}
                            class="size-7 text-primary"
                          />
                        </span>
                      }
                    >
                      <img
                        data-origin
                        src={entry.thumb}
                        alt=""
                        loading="lazy"
                        class="size-10 rounded-md object-cover"
                      />
                    </Show>
                    <span
                      class={cn(
                        "absolute -bottom-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full border-2 border-(--files-card-bg) transition-opacity",
                        isSel()
                          ? "bg-primary text-primary-foreground opacity-100"
                          : "bg-muted opacity-0 group-hover:opacity-100",
                      )}
                    >
                      <Show when={isSel()}>
                        <TbCheck class="size-3" />
                      </Show>
                    </span>
                  </button>
                  <div class="min-w-0">
                    <div class="flex min-w-0 items-center gap-2">
                      <span
                        class={cn(
                          "truncate text-sm",
                          playing() && "font-medium text-primary",
                        )}
                        title={entry.name}
                      >
                        {entry.name}
                      </span>
                      <Show when={playing()}>
                        <span class="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary px-1.5 py-0.5 text-[11px] leading-none text-primary-foreground">
                          <TbChartBar class="size-3" />
                          播放中
                        </span>
                      </Show>
                    </div>
                    <Show when={isPhone()}>
                      <div class="truncate text-xs text-muted-foreground">
                        {entry.is_dir ? "" : `${formatSize(entry.size)} · `}
                        {formatTime(entry.modified)}
                      </div>
                    </Show>
                  </div>
                  <Show when={!isPhone()}>
                    <span class="text-right text-xs tabular-nums text-muted-foreground">
                      {entry.is_dir ? "" : formatSize(entry.size)}
                    </span>
                    <span class="text-xs tabular-nums text-muted-foreground">
                      {formatTime(entry.modified)}
                    </span>
                  </Show>
                  <Show when={!entry.is_dir} fallback={<span />}>
                    <IconButton
                      label={`下载 ${entry.name}`}
                      testid="row-download"
                      class={cn(
                        !isPhone() &&
                          "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100",
                      )}
                      onClick={(e) => {
                        e.stopPropagation()
                        download(entry)
                      }}
                    >
                      <TbDownload />
                    </IconButton>
                  </Show>
                </div>
              )
            }}
          </For>
        </ContextMenuTrigger>
        <ContextMenuContent class={MENU_MOTION} data-testid="context-menu">
          <Show when={menuTargets().length === 1}>
            <ContextMenuItem
              onSelect={() => openEntry(menuTargets()[0]!, "list")}
            >
              打开
            </ContextMenuItem>
          </Show>
          <Show when={files(menuTargets()).length > 0}>
            <ContextMenuItem
              data-testid="menu-download"
              onSelect={() => downloadAll(menuTargets())}
            >
              {files(menuTargets()).length > 1
                ? `下载 ${files(menuTargets()).length} 个文件`
                : "下载"}
            </ContextMenuItem>
          </Show>
          <Show when={menuTargets().length === 1 && !menuTargets()[0]!.is_dir}>
            <ContextMenuItem
              onSelect={() => void copyText(linkOf(menuTargets()[0]!))}
            >
              复制链接
            </ContextMenuItem>
          </Show>
          <Show when={menuTargets().length > 0}>
            <ContextMenuSeparator />
            <ContextMenuItem onSelect={() => setShareFor(menuTargets())}>
              分享
            </ContextMenuItem>
          </Show>
          <Show when={menuTargets().length === 0}>
            <ContextMenuItem disabled>空白处</ContextMenuItem>
          </Show>
        </ContextMenuContent>
      </ContextMenu>
      <SelectionBar
        chosen={chosen()}
        onDownload={() => downloadAll(chosen())}
        onShare={() => setShareFor(chosen())}
        onClear={() => setSelected(new Set<string>())}
      />
    </div>
  )
}

/** In 200ms from below, out in 150ms (02 §三, 选择条出现). */
const SelectionBar = (props: {
  chosen: Entry[]
  onDownload: () => void
  onShare: () => void
  onClear: () => void
}) => {
  const files = () => props.chosen.filter((e) => !e.is_dir).length
  const enter = (el: Element, done: () => void) => {
    const kf = reducedMotion()
      ? [{ opacity: 0 }, { opacity: 1 }]
      : [
          { opacity: 0, transform: "translateY(16px)" },
          { opacity: 1, transform: "none" },
        ]
    void run("selection-bar-in", el, kf, "bar-open", "emphasized-decel").then(
      done,
    )
  }
  const exit = (el: Element, done: () => void) => {
    const kf = reducedMotion()
      ? [{ opacity: 1 }, { opacity: 0 }]
      : [
          { opacity: 1, transform: "none" },
          { opacity: 0, transform: "translateY(16px)" },
        ]
    void run("selection-bar-out", el, kf, "bar-close", "emphasized-accel", {
      fill: "forwards",
    }).then(done)
  }
  return (
    <div class="pointer-events-none fixed inset-x-0 bottom-4 z-30 flex justify-center px-3">
      <Transition onEnter={enter} onExit={exit}>
        <Show when={props.chosen.length > 0}>
          <div
            data-testid="selection-bar"
            class="pointer-events-auto flex items-center gap-1 rounded-xl border bg-popover px-2 py-1.5 text-popover-foreground shadow-lg"
          >
            <span class="px-2 text-sm tabular-nums">
              已选 {props.chosen.length} 项
            </span>
            <Button
              variant="ghost"
              size="sm"
              data-testid="bar-download"
              disabled={files() === 0}
              onClick={props.onDownload}
              class="gap-1.5"
            >
              <TbDownload class="size-4" />
              下载
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={props.onShare}
              class="gap-1.5"
            >
              <TbShare class="size-4" />
              分享
            </Button>
            <IconButton label="取消选择" onClick={props.onClear}>
              <TbX />
            </IconButton>
          </div>
        </Show>
      </Transition>
    </div>
  )
}
