import { createSignal, onCleanup, Show } from "solid-js"
import { Dynamic } from "solid-js/web"
import { LinkWithPush } from "~/components"
import { useUtil } from "~/hooks"
import { checkboxOpen, getMainColor, local, OrderBy } from "~/store"
import { ObjType, StoreObj } from "~/types"
import { bus, isTouchDevice } from "~/utils"
import { cn } from "~/utils/cn"
import { getIconByObj } from "~/utils/icon"
import { ExtraBadges } from "./ExtraBadges"
import {
  EpisodeText,
  ModifiedText,
  SizeOrUsage,
} from "~/features/files/ItemMeta"
import { PhoneRowBody } from "~/features/files/PhoneRowBody"
import { RowThumb } from "~/features/files/RowThumb"
import { PlayingBadge, RowDownload } from "~/features/files/RowExtras"
import { phoneShell } from "~/features/shell/topbar-slot"
import { useFileRowInteraction } from "./helper"
import { ItemCheckbox } from "./ItemCheckbox"
import {
  isMediaPreviewEnabled,
  shouldShowPreview,
} from "~/plugins/builtin/media-preview/preview"

export interface Col {
  name: OrderBy
  /** Tailwind: the column's text alignment. */
  align: string
  /** Tailwind: the column's width (responsive). */
  w: string
}

// Shared with the `ListTitle` header in ./List.tsx, so header and rows stay
// aligned by construction rather than by copy.
//
// The `md` split was 50/17/33: a third of every row was reserved for a
// 19-character timestamp. `formatDateCompact` caps `modified` at 11 characters,
// so that reserve is no longer needed and the freed width goes to `name`, which
// is what users actually scan. `size` keeps 17% because mount points render a
// disk-usage progress bar in that slot, not just a short byte count.
export const cols: Col[] = [
  { name: "name", align: "text-left", w: "w-[76%] md:w-[63%]" },
  { name: "size", align: "text-right", w: "w-[24%] md:w-[17%]" },
  { name: "modified", align: "text-right", w: "w-0 md:w-[20%]" },
]

const PREVIEW_DELAY_MS = 550

export const ListItem = (props: {
  obj: StoreObj
  index: number
  /** Off for virtualized rows, which mount constantly while scrolling. */
}) => {
  const { isHide } = useUtil()
  if (isHide(props.obj)) {
    return null
  }
  // Shared with MediaListItem — see useFileRowInteraction.
  const ix = useFileRowInteraction(
    () => props.obj,
    () => props.index,
  )
  const filenameStyle = () => local["list_item_filename_overflow"]
  // Clicking an image's picture opens the gallery instead of the row's link.
  const openGallery = (e: MouseEvent) => {
    if (props.obj.type !== ObjType.IMAGE) return
    if (e.ctrlKey || e.metaKey || e.shiftKey) return
    if (!ix.restoreSelectionCache()) return
    bus.emit("gallery", props.obj.name)
    e.preventDefault()
    e.stopPropagation()
  }

  // Hover preview state — desktop/non-touch only
  const [previewVisible, setPreviewVisible] = createSignal(false)
  let hoverTimer: ReturnType<typeof setTimeout> | undefined

  const clearHoverTimer = () => {
    if (hoverTimer !== undefined) {
      clearTimeout(hoverTimer)
      hoverTimer = undefined
    }
  }

  const handleMouseEnter = () => {
    ix.onMouseEnter()
    if (
      shouldShowPreview({
        thumb: props.obj.thumb,
        isTouch: isTouchDevice(),
        enabled: isMediaPreviewEnabled(),
      })
    ) {
      clearHoverTimer()
      hoverTimer = setTimeout(() => setPreviewVisible(true), PREVIEW_DELAY_MS)
    }
  }

  const handleMouseLeave = () => {
    clearHoverTimer()
    setPreviewVisible(false)
  }

  onCleanup(() => {
    clearHoverTimer()
  })

  return (
    <div
      style={{
        width: "100%",
        position: "relative",
      }}
    >
      <LinkWithPush
        class={`list-item ${cn(
          "viselect-item group/row flex w-full items-center rounded-lg p-2 transition-all duration-300 hover:scale-[1.01] hover:bg-accent",
          props.obj.selected && "selected bg-accent",
          ix.cursor() === "pointer" ? "cursor-pointer" : "cursor-default",
        )}`}
        data-index={props.index}
        data-row-name={props.obj.name}
        href={props.obj.name}
        on:dblclick={ix.onDblClick}
        on:click={ix.onClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onContextMenu={ix.onContextMenu}
        on:pointerdown={ix.onPointerDown}
        on:pointermove={ix.onPointerMove}
        on:pointerup={ix.onPointerEnd}
        on:pointercancel={ix.onPointerEnd}
      >
        <Show when={phoneShell()}>
          <PhoneRowBody obj={props.obj} />
        </Show>
        <Show when={!phoneShell()}>
          <div class={cn("name-box flex items-center gap-x-1", cols[0].w)}>
            <Show when={checkboxOpen()}>
              <ItemCheckbox
                stop
                checked={props.obj.selected}
                onChange={ix.onCheckboxChange}
              />
            </Show>
            <RowThumb
              obj={props.obj}
              onClick={openGallery}
              fallback={
                <Dynamic
                  component={getIconByObj(props.obj)}
                  class={cn(
                    "icon mr-1 size-6 shrink-0",
                    props.obj.type !== ObjType.IMAGE
                      ? "cursor-[inherit]"
                      : "cursor-pointer",
                  )}
                  style={{ color: getMainColor() }}
                  on:click={openGallery}
                />
              }
            />
            <p
              class={cn(
                "name break-all [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
                filenameStyle() === "multi_line"
                  ? "whitespace-normal"
                  : "whitespace-nowrap",
                filenameStyle() === "scrollable"
                  ? "overflow-x-auto"
                  : "overflow-x-hidden",
                filenameStyle() === "ellipsis" ? "text-ellipsis" : "text-clip",
              )}
              title={props.obj.name}
            >
              {props.obj.name}
            </p>
            <EpisodeText name={props.obj.name} />
            <ExtraBadges extra={props.obj.extra} />
            <PlayingBadge name={props.obj.name} />
            <span class="ml-auto" />
            <RowDownload obj={props.obj} />
          </div>
          <div class={cn(cols[1].w, cols[1].align)}>
            <SizeOrUsage obj={props.obj} />
          </div>
          <div class={cn("hidden md:block", cols[2].w, cols[2].align)}>
            <ModifiedText modified={props.obj.modified} />
          </div>
        </Show>
      </LinkWithPush>

      {/* Hover thumbnail preview — desktop only, gated by plugin enabled state */}
      <Show when={previewVisible()}>
        <div
          class="media-hover-preview pointer-events-none absolute top-1/2 left-[52%] z-[1000] animate-[mediaPreviewFadeIn_0.18s_ease-out_forwards]"
          // Position to the right of the name column, slightly above center
          style={{ transform: "translateY(-50%)" }}
        >
          <img
            src={props.obj.thumb}
            class="block max-h-[240px] max-w-[320px] rounded-lg border-2 border-border bg-card object-contain shadow-2xl"
          />
        </div>
      </Show>
    </div>
  )
}
