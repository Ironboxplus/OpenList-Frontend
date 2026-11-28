import { Show } from "solid-js"
import { Dynamic } from "solid-js/web"
import { CenterLoading, LinkWithPush, ImageWithError } from "~/components"
import { usePath, useUtil } from "~/hooks"
import { openListed } from "~/features/viewer/state"
import { checkboxOpen, getMainColor, local, selectIndex } from "~/store"
import { ObjType, StoreObj } from "~/types"
import { bus, getFileSize } from "~/utils"
import { cn } from "~/utils/cn"
import { getIconByObj } from "~/utils/icon"
import { ExtraBadges } from "./ExtraBadges"
import type { GridDecor } from "~/features/files/grid-decor"
import { FileCard, FolderChip } from "~/features/files/GridCard"
import { PlayingBadge, RowDownload } from "~/features/files/RowExtras"
import { CardBadge, CardTag, SelectCheck } from "~/features/files/GridBadges"
import { PosterArt } from "~/features/files/PosterArt"
import { selectionMode } from "~/features/files/selection-mode"
import { phoneShell, shellActive } from "~/features/shell/topbar-slot"
import { createLongPress } from "~/utils/touch"
import { selectForMenu, useSelectWithMouse } from "./helper"
import { ItemCheckbox } from "./ItemCheckbox"

export const GridItem = (props: {
  obj: StoreObj
  index: number
  /** Poster image URL; shown 2:3 and lazy, the icon takes over if it fails. */
  cover?: string
  /** Off for virtualized rows, which mount constantly while scrolling. */
  /** Media view: replaces the name, size line and poster of this card. */
  decor?: () => GridDecor | undefined
  /** Folder chip / file card (name row over the thumbnail) instead of the poster layout. */
  card?: boolean
}) => {
  const decor = () => props.decor?.()
  const cover = () => props.cover ?? decor()?.cover
  const { isHide } = useUtil()
  if (isHide(props.obj)) {
    return null
  }
  const { setPathAs } = usePath()
  const filenameStyle = () => local["list_item_filename_overflow"]
  const objIcon = (
    <Dynamic
      component={getIconByObj(props.obj)}
      style={{
        color: getMainColor(),
        width: `${parseInt(local["grid_item_size"]) - 30}px`,
        height: `${parseInt(local["grid_item_size"]) - 30}px`,
      }}
    />
  )
  const { openWithDoubleClick, toggleWithClick, restoreSelectionCache } =
    useSelectWithMouse()
  // The classic checkbox mode: a checkbox takes the card's icon place.
  const cardCheckbox = () =>
    checkboxOpen() && !phoneShell()
      ? () => (
          <ItemCheckbox
            stop
            checked={props.obj.selected}
            onChange={(on) => {
              selectIndex(props.index, on)
            }}
          />
        )
      : undefined
  // Phone: long press selects, then taps toggle (same rule as the list rows).
  const press = createLongPress(() => {
    if (phoneShell() && !props.obj.selected) selectIndex(props.index, true)
  })
  return (
    <div
      style={{
        width: "100%",
      }}
    >
      <LinkWithPush
        class={cn(
          "grid-item viselect-item group/row flex w-full flex-col items-center gap-y-1 rounded-lg p-1 transition-all duration-300 hover:[transform:scale(1.06)] hover:bg-accent",
          props.obj.selected && "selected bg-accent",
          props.card && "grid-card",
          props.card && props.obj.is_dir && "folder",
          openWithDoubleClick() || toggleWithClick()
            ? "cursor-default"
            : "cursor-pointer",
        )}
        data-index={props.index}
        data-row-name={props.obj.name}
        href={props.obj.name}
        on:dblclick={(e: MouseEvent) => {
          if (!openWithDoubleClick()) return
          selectIndex(props.index, true, true)
          openListed(props.obj, e.currentTarget as Element)
        }}
        on:pointerdown={press.onPointerDown}
        on:pointermove={press.onPointerMove}
        on:pointerup={press.onPointerEnd}
        on:pointercancel={press.onPointerEnd}
        on:click={(e: MouseEvent) => {
          e.preventDefault()
          if (phoneShell()) {
            if (press.consumeClick()) return
            if (selectionMode())
              return selectIndex(props.index, !props.obj.selected)
          }
          if (openWithDoubleClick()) return
          if (e.ctrlKey || e.metaKey || e.shiftKey) return
          if (!restoreSelectionCache()) return
          if (toggleWithClick())
            return selectIndex(props.index, !props.obj.selected)
          openListed(props.obj, e.currentTarget as Element)
        }}
        onMouseEnter={() => {
          setPathAs(props.obj.name, props.obj.is_dir, true)
        }}
        onContextMenu={(e: MouseEvent) => {
          if (phoneShell()) return e.preventDefault()
          selectForMenu(props.index)
        }}
      >
        <Show
          when={props.card}
          fallback={
            <>
              <div
                class={cn(
                  "item-thumbnail relative flex w-full items-center justify-center",
                  props.obj.type !== ObjType.IMAGE
                    ? "cursor-[inherit]"
                    : "cursor-pointer",
                )}
                style={{
                  height:
                    cover() || decor()?.placeholder || decor()?.mosaic?.length
                      ? undefined
                      : `${parseInt(local["grid_item_size"])}px`,
                }}
                on:click={(e: MouseEvent) => {
                  if (props.obj.type !== ObjType.IMAGE) return
                  if (e.ctrlKey || e.metaKey || e.shiftKey) return
                  if (!restoreSelectionCache()) return
                  bus.emit("gallery", props.obj.name)
                  e.preventDefault()
                  e.stopPropagation()
                }}
              >
                <Show when={decor()?.badge}>
                  <CardBadge text={decor()!.badge!} />
                </Show>
                <Show when={decor()?.tag}>
                  <CardTag text={decor()!.tag!} />
                </Show>
                <Show when={selectionMode()}>
                  <SelectCheck selected={props.obj.selected} />
                </Show>
                <Show when={checkboxOpen() && !phoneShell()}>
                  <ItemCheckbox
                    stop
                    class="absolute top-1 left-1"
                    checked={props.obj.selected}
                    onChange={(on) => {
                      selectIndex(props.index, on)
                    }}
                  />
                </Show>
                <PosterArt
                  decor={decor()}
                  cover={props.cover}
                  seed={props.obj.name}
                  alt={props.obj.name}
                  fallback={
                    <Show when={props.obj.thumb} fallback={objIcon}>
                      <ImageWithError
                        class="max-h-full max-w-full rounded-lg shadow-md"
                        fallback={<CenterLoading size="lg" />}
                        fallbackErr={objIcon}
                        src={props.obj.thumb}
                        loading="lazy"
                      />
                    </Show>
                  }
                />
              </div>
              <p
                class={cn(
                  "name w-full overflow-y-hidden text-center text-sm break-all [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
                  filenameStyle() === "multi_line"
                    ? "whitespace-normal"
                    : "whitespace-nowrap",
                  filenameStyle() === "scrollable"
                    ? "overflow-x-auto"
                    : "overflow-x-hidden",
                  filenameStyle() === "ellipsis"
                    ? "text-ellipsis"
                    : "text-clip",
                )}
                title={decor()?.label ?? props.obj.name}
              >
                {decor()?.label ?? props.obj.name}
              </p>
              <Show
                when={decor()?.sub}
                fallback={
                  <Show
                    when={shellActive() && !props.obj.is_dir && props.obj.size}
                  >
                    <p class="text-xs text-muted-foreground meta">
                      {getFileSize(props.obj.size)}
                    </p>
                  </Show>
                }
              >
                <p class="text-xs text-muted-foreground meta">{decor()!.sub}</p>
              </Show>
              <ExtraBadges extra={props.obj.extra} maxTags={1} />
            </>
          }
        >
          <Show
            when={props.obj.is_dir}
            fallback={
              <FileCard
                obj={props.obj}
                selected={!!props.obj.selected}
                selecting={selectionMode()}
                checkbox={cardCheckbox()}
                extra={<ExtraBadges extra={props.obj.extra} maxTags={1} />}
                actions={
                  <>
                    <PlayingBadge name={props.obj.name} />
                    <RowDownload obj={props.obj} />
                  </>
                }
                onThumbClick={
                  props.obj.type === ObjType.IMAGE
                    ? (e) => {
                        if (e.ctrlKey || e.metaKey || e.shiftKey) return
                        if (!restoreSelectionCache()) return
                        bus.emit("gallery", props.obj.name)
                        e.preventDefault()
                        e.stopPropagation()
                      }
                    : undefined
                }
              />
            }
          >
            <FolderChip
              obj={props.obj}
              selected={!!props.obj.selected}
              selecting={selectionMode()}
              checkbox={cardCheckbox()}
              extra={<ExtraBadges extra={props.obj.extra} maxTags={1} />}
            />
          </Show>
        </Show>
      </LinkWithPush>
    </div>
  )
}
