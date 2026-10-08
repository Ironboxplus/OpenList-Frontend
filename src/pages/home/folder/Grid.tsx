import { Box, Grid, Text } from "@hope-ui/solid"
import { createMemo, createSignal, For, onCleanup, Show } from "solid-js"
import { GridItem } from "./GridItem"
import "lightgallery/css/lightgallery-bundle.css"
import { smartCountMsg, local, objStore, getPagination } from "~/store"
import { useSelectWithMouse } from "./helper"
import { VirtualRows } from "~/features/files/VirtualRows"
import { gridColumns, shouldVirtualize } from "~/features/files/virtualize"
import { createViewport } from "~/features/shell/viewport"
import { shellActive } from "~/features/shell/topbar-slot"

const GRID_GAP = 8

const GridLayout = () => {
  const { isMouseSupported, registerSelectContainer, captureContentMenu } =
    useSelectWithMouse()
  registerSelectContainer()

  const pagerType = getPagination().type
  const virtual = createMemo(() =>
    shouldVirtualize(pagerType, objStore.objs.length),
  )
  const viewport = createViewport()
  const [width, setWidth] = createSignal(0)
  const columns = createMemo(() => gridColumns(width(), viewport()))
  // Thumbnail box + two name lines + padding; measured after first render.
  const rowEstimate = () => parseInt(local["grid_item_size"]) + 84
  const rowCount = () => Math.ceil(objStore.objs.length / columns())

  const watchWidth = (el: HTMLElement) => {
    const ro = new ResizeObserver(() => setWidth(el.clientWidth))
    ro.observe(el)
    setWidth(el.clientWidth)
    onCleanup(() => ro.disconnect())
  }

  return (
    <>
      <Show when={local["show_count_msg"] === "visible"}>
        <Box w="100%" textAlign="left" pl="$2">
          <Text size="sm" color="$neutral11">
            {smartCountMsg()}
          </Text>
        </Box>
      </Show>
      <Show
        when={virtual()}
        fallback={
          <Grid
            oncapture:contextmenu={captureContentMenu}
            class="viselect-container files-grid"
            w="$full"
            gap="$1"
            templateColumns={`repeat(auto-fill, minmax(${
              parseInt(local["grid_item_size"]) + 20
            }px,1fr))`}
          >
            <For each={objStore.objs}>
              {(obj, i) => {
                return <GridItem obj={obj} index={i()} />
              }}
            </For>
          </Grid>
        }
      >
        <div
          oncapture:contextmenu={captureContentMenu}
          class="viselect-container files-grid-virtual"
          style={{ width: "100%", padding: shellActive() ? "0.5rem" : "0" }}
        >
          <VirtualRows
            ref={watchWidth}
            count={rowCount()}
            estimate={rowEstimate()}
            gap={GRID_GAP}
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
                  each={objStore.objs.slice(
                    row * columns(),
                    (row + 1) * columns(),
                  )}
                >
                  {(obj, k) => (
                    <GridItem
                      obj={obj}
                      index={row * columns() + k()}
                      animate={false}
                    />
                  )}
                </For>
              </div>
            )}
          />
        </div>
      </Show>
    </>
  )
}

export default GridLayout
