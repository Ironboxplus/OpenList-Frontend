import { createMemo, createSignal, Show } from "solid-js"
import { Dynamic } from "solid-js/web"
import { AiFillStar } from "solid-icons/ai"
import { LinkWithPush } from "~/components"
import { checkboxOpen, getMainColor, local } from "~/store"
import { StoreObj } from "~/types"
import { formatDate, formatDateCompact, getFileSize } from "~/utils"
import { cn } from "~/utils/cn"
import { getIconByObj } from "~/utils/icon"
import { readExtra } from "./extra-meta"
import { useFileRowInteraction } from "./helper"
import { ItemCheckbox } from "./ItemCheckbox"
import { episodeFor } from "~/features/media/state"
import { PlayingBadge, RowDownload } from "~/features/files/RowExtras"

/**
 * Two-line media row, used instead of {@link ListItem} inside storages whose
 * driver supplies media metadata (see `mediaPreset` in ./media-preset).
 *
 * Why a separate component rather than more columns on the table row: the table
 * layout allocates fixed percentage widths, so a short name wastes space while a
 * long release name (`落水狗.Reservoir.Dogs.1992.UHD.BluRay.2160p.x265…`) pushes
 * the metadata out of view entirely. Here the title owns a whole line and the
 * metadata owns its own, so neither can squeeze the other.
 *
 * Every field is optional and independently degraded — 115 does not populate
 * `play_long`/`def` for older uploads, and other drivers populate none of them.
 * A row with no extra metadata renders as title + size, never as empty slots.
 *
 * All values come from the `fs/list` payload that is already fetched for the
 * directory (`obj.thumb`, and `obj.extra` via `drivers/115_open/types.go`'s
 * `Extra()`), so rendering this costs no extra request and cannot trip the
 * provider's rate limit.
 */

/** 16:9 thumbnail box. Sized so the two text lines set the row height, not the image. */
const THUMB_W = 64
const THUMB_H = 36

export const MediaListItem = (props: {
  obj: StoreObj
  index: number
  /** Off for virtualized rows, which mount constantly while scrolling. */
}) => {
  // Selection / open / context-menu behaviour is shared with the table row —
  // see useFileRowInteraction. Only the visuals below are specific to this row.
  const ix = useFileRowInteraction(
    () => props.obj,
    () => props.index,
  )

  const meta = createMemo(() => readExtra(props.obj.extra))
  const [thumbFailed, setThumbFailed] = createSignal(false)
  const showThumb = () => !!props.obj.thumb && !thumbFailed()

  // Resolution labels come from 115's `def`/`def2` codes (see defLabel in
  // drivers/115_open/types.go). Only the top tiers earn an accent colour — if
  // everything is highlighted, nothing is.
  const resolutionAccent = () =>
    ["4K", "原画", "FHD"].includes(meta().resolution)

  /**
   * Secondary line. Built by filtering then joining so a missing field never
   * leaves a dangling separator (`4K ·  · 22.3G`).
   */
  const secondary = () =>
    [
      episodeFor(props.obj.name)?.text,
      meta().duration,
      props.obj.is_dir ? "" : getFileSize(props.obj.size),
      formatDateCompact(props.obj.modified),
    ]
      .filter((s) => s && s !== "-")
      .join("  ·  ")

  return (
    <div style={{ width: "100%" }}>
      <LinkWithPush
        class={cn(
          "media-list-item viselect-item group/row flex w-full items-center gap-x-3 rounded-lg p-2 hover:bg-accent",
          // Only the background transitions. `transition: all` on every row of a
          // long list animates properties that never needed animating.
          "transition-colors duration-150",
          props.obj.selected && "selected bg-accent",
          ix.cursor() === "pointer" ? "cursor-pointer" : "cursor-default",
        )}
        data-index={props.index}
        data-row-name={props.obj.name}
        href={props.obj.name}
        on:dblclick={ix.onDblClick}
        on:click={ix.onClick}
        onMouseEnter={ix.onMouseEnter}
        onContextMenu={ix.onContextMenu}
        on:pointerdown={ix.onPointerDown}
        on:pointermove={ix.onPointerMove}
        on:pointerup={ix.onPointerEnd}
        on:pointercancel={ix.onPointerEnd}
      >
        <Show when={checkboxOpen()}>
          <ItemCheckbox
            stop
            checked={props.obj.selected}
            onChange={ix.onCheckboxChange}
          />
        </Show>

        {/* Thumbnail, degrading to the type icon when absent or broken. A failed
            image must not leave a blank hole where the icon should be. */}
        <div
          class="media-thumb flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted"
          style={{ width: `${THUMB_W}px`, height: `${THUMB_H}px` }}
        >
          <Show
            when={showThumb()}
            fallback={
              <Dynamic
                component={getIconByObj(props.obj)}
                class="size-5"
                style={{ color: getMainColor() }}
              />
            }
          >
            <img
              data-origin
              src={props.obj.thumb}
              loading="lazy"
              class="block h-full w-full object-cover"
              on:error={() => setThumbFailed(true)}
            />
          </Show>
        </div>

        {/* min-w=0 is what lets the title truncate instead of forcing the row wider. */}
        <div class="media-text flex min-w-0 flex-1 flex-col items-start gap-y-0.5">
          <div class="flex flex-row w-full items-center gap-x-2">
            <p
              class={cn(
                "name min-w-0 flex-1 overflow-hidden text-sm font-medium text-ellipsis",
                local["list_item_filename_overflow"] === "multi_line"
                  ? "whitespace-normal"
                  : "whitespace-nowrap",
              )}
              title={props.obj.name}
            >
              {props.obj.name}
            </p>
            <PlayingBadge name={props.obj.name} />
            <Show when={meta().starred}>
              <AiFillStar class="text-warning" title="starred" />
            </Show>
            <Show when={meta().resolution}>
              <p
                class={cn(
                  "resolution shrink-0 rounded-sm px-1.5 text-xs font-medium",
                  resolutionAccent()
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {meta().resolution}
              </p>
            </Show>
          </div>

          <div class="flex flex-row w-full items-center text-muted-foreground text-xs gap-x-2">
            <p
              class="meta overflow-hidden text-ellipsis whitespace-nowrap tabular-nums"
              title={
                props.obj.modified ? formatDate(props.obj.modified) : undefined
              }
            >
              {secondary()}
            </p>
            <Show when={meta().tags.length}>
              <div class="flex flex-row items-center shrink-0 gap-x-1">
                {meta()
                  .tags.slice(0, 2)
                  .map((tag) => (
                    <p class="tag rounded-sm bg-muted px-1 text-xs whitespace-nowrap">
                      {tag}
                    </p>
                  ))}
              </div>
            </Show>
          </div>
        </div>
        <RowDownload obj={props.obj} />
      </LinkWithPush>
    </div>
  )
}

export default MediaListItem
