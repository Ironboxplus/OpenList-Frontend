import { Box, Grid, Text } from "@hope-ui/solid"
import { createMemo, createSignal, For, onCleanup, Show } from "solid-js"
import { GridItem } from "./GridItem"
import "lightgallery/css/lightgallery-bundle.css"
import { smartCountMsg, local, objStore, getPagination } from "~/store"
import { useT, useUtil } from "~/hooks"
import { useSelectWithMouse } from "./helper"
import { VirtualRows } from "~/features/files/VirtualRows"
import {
  cardColumns,
  gridColumns,
  rowOfItem,
  sectionRows,
  shouldVirtualize,
} from "~/features/files/virtualize"
import { createViewport } from "~/features/shell/viewport"
import type { GridDecor } from "~/features/files/grid-decor"
import type { StoreObj } from "~/types"

const GRID_GAP = 8
const CARD_GAP = 16

export interface GridLayoutProps {
  /** Which store indices to show, in which order (default: all, as stored). */
  order?: () => number[]
  /** Per-card overrides (poster, title, year, badge). */
  decorate?: (obj: StoreObj) => GridDecor | undefined
  /** 2:3 posters: rows are taller than icon cards. */
  poster?: boolean
}

/**
 * The folder's cards, as in Cloudreve: a "Folders" section of flat chips and a
 * "Files" section of cards with their thumbnails. The poster wall (the media
 * view) keeps the single grid of posters.
 */
const GridLayout = (props: GridLayoutProps) => {
  const t = useT()
  const { isHide } = useUtil()
  const { isMouseSupported, registerSelectContainer } = useSelectWithMouse()
  registerSelectContainer()

  const pagerType = getPagination().type
  const virtual = createMemo(() =>
    shouldVirtualize(pagerType, objStore.objs.length),
  )
  const order = createMemo(
    () => props.order?.() ?? objStore.objs.map((_, i) => i),
  )
  const viewport = createViewport()
  const [width, setWidth] = createSignal(0)
  const columns = createMemo(() => gridColumns(width(), viewport()))
  // Thumbnail box + two name lines + padding; measured after first render.
  const rowEstimate = () =>
    props.poster
      ? Math.round(((width() || 800) / columns()) * 1.5) + 84
      : parseInt(local["grid_item_size"]) + 84
  const rowCount = () => Math.ceil(order().length / columns())
  const card = (i: number) => (
    <Show when={objStore.objs[i]} keyed>
      {(obj) => (
        <GridItem
          obj={obj}
          index={i}
          card={!props.poster}
          decor={props.decorate ? () => props.decorate!(obj) : undefined}
        />
      )}
    </Show>
  )

  const watchWidth = (el: HTMLElement) => {
    const ro = new ResizeObserver(() => setWidth(el.clientWidth))
    ro.observe(el)
    setWidth(el.clientWidth)
    onCleanup(() => ro.disconnect())
  }

  // Cards: folders first, then files, each in the order the list has.
  const sections = createMemo(() => {
    const folders: number[] = []
    const files: number[] = []
    for (const i of order()) {
      const obj = objStore.objs[i]
      if (!obj || isHide(obj)) continue
      ;(obj.is_dir ? folders : files).push(i)
    }
    return [
      { title: t("files.folders"), items: folders },
      { title: t("files.files"), items: files },
    ]
  })
  const cardCols = createMemo(() => cardColumns(width(), viewport()))
  const rows = createMemo(() => sectionRows(sections(), cardCols()))

  const countMsg = (
    <Show when={local["show_count_msg"] === "visible"}>
      <Box w="100%" textAlign="left" pl="$2">
        <Text size="sm" color="$neutral11">
          {smartCountMsg()}
        </Text>
      </Box>
    </Show>
  )

  return (
    <>
      {countMsg}
      <Show
        when={!props.poster}
        fallback={
          <Show
            when={virtual()}
            fallback={
              <Grid
                class="viselect-container files-grid"
                w="$full"
                gap="$1"
                templateColumns={`repeat(auto-fill, minmax(${
                  parseInt(local["grid_item_size"]) + 20
                }px,1fr))`}
              >
                <For each={order()}>{(i) => card(i)}</For>
              </Grid>
            }
          >
            <div
              class="viselect-container files-grid-virtual"
              style={{ width: "100%", padding: "0.5rem" }}
            >
              <VirtualRows
                ref={watchWidth}
                count={rowCount()}
                estimate={rowEstimate()}
                gap={GRID_GAP}
                rowOf={(i) => Math.floor(order().indexOf(i) / columns())}
                render={(row) => (
                  <div
                    class="grid-row"
                    style={{
                      display: "grid",
                      gap: `${GRID_GAP}px`,
                      "grid-template-columns": `repeat(${columns()}, minmax(0, 1fr))`,
                    }}
                  >
                    <For
                      each={order().slice(
                        row * columns(),
                        (row + 1) * columns(),
                      )}
                    >
                      {(i) => card(i)}
                    </For>
                  </div>
                )}
              />
            </div>
          </Show>
        }
      >
        <Show
          when={virtual()}
          fallback={
            <div class="viselect-container files-sections">
              <For each={sections()}>
                {(section, n) => (
                  <Show when={section.items.length > 0}>
                    <section>
                      <h3 class="files-section-title">{section.title}</h3>
                      <div
                        class="files-cards"
                        classList={{ "files-cards-folders": n() === 0 }}
                      >
                        <For each={section.items}>{(i) => card(i)}</For>
                      </div>
                    </section>
                  </Show>
                )}
              </For>
            </div>
          }
        >
          <div class="viselect-container files-sections">
            <VirtualRows
              ref={watchWidth}
              count={rows().length}
              estimate={200}
              gap={CARD_GAP}
              rowOf={(i) => rowOfItem(rows(), i)}
              render={(n) => {
                const row = rows()[n]
                return (
                  <Show when={row}>
                    {(r) => (
                      <Show
                        when={r().kind === "cards"}
                        fallback={
                          <h3 class="files-section-title">
                            {(r() as { text: string }).text}
                          </h3>
                        }
                      >
                        <div
                          style={{
                            display: "grid",
                            gap: `${CARD_GAP}px`,
                            "grid-template-columns": `repeat(${cardCols()}, minmax(0, 1fr))`,
                          }}
                        >
                          <For each={(r() as { items: number[] }).items}>
                            {(i) => card(i)}
                          </For>
                        </div>
                      </Show>
                    )}
                  </Show>
                )
              }}
            />
          </div>
        </Show>
      </Show>
    </>
  )
}

export default GridLayout
