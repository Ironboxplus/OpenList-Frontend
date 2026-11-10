import { Box, HStack, VStack, Text } from "@hope-ui/solid"
import {
  batch,
  createEffect,
  createMemo,
  createSignal,
  For,
  Show,
} from "solid-js"
import { AiOutlineArrowUp } from "solid-icons/ai"
import { useT, useRouter } from "~/hooks"
import {
  allChecked,
  checkboxOpen,
  countMsg,
  isIndeterminate,
  local,
  objStore,
  selectAll,
  selectedMsg,
  sortObjs,
  getPagination,
} from "~/store"
import { OrderBy } from "~/store"
import { Col, cols, ListItem } from "./ListItem"
import { MediaListItem } from "./MediaListItem"
import { shouldUseMediaRows } from "./row-layout"
import { ItemCheckbox, useSelectWithMouse } from "./helper"
import { bus } from "~/utils"
import { VirtualRows } from "~/features/files/VirtualRows"
import { rowEstimate, shouldVirtualize } from "~/features/files/virtualize"
import { phoneShell } from "~/features/shell/topbar-slot"
import { StoreObj } from "~/types"
import { loadSortState, saveSortState } from "./sort-state"

export const ListTitle = (props: {
  sortCallback: (orderBy: OrderBy, reverse?: boolean) => void
  disableCheckbox?: boolean
  initialOrder?: OrderBy
  initialReverse?: boolean
  /**
   * Media rows are a single flex line, so the percentage columns below would
   * label nothing. `compact` keeps the same sort state and handlers and only
   * changes how they are laid out — sorting is a header-only affordance, so
   * hiding the header would remove it entirely (REFACTOR_PLAN §7.13: one
   * behaviour, one implementation, differences at the outermost layer).
   */
  compact?: boolean
}) => {
  const t = useT()
  const { pathname } = useRouter()

  const [orderBy, setOrderBy] = createSignal<OrderBy | undefined>(
    props.initialOrder,
  )
  const [reverse, setReverse] = createSignal(props.initialReverse ?? false)

  createEffect(() => {
    if (props.initialOrder !== undefined) {
      setOrderBy(props.initialOrder)
      setReverse(props.initialReverse ?? false)
    }
  })

  createEffect(() => {
    if (orderBy()) {
      saveSortState(pathname(), { orderBy: orderBy()!, reverse: reverse() })
      props.sortCallback(orderBy()!, reverse())
    }
  })

  const onSort = (col: Col) => {
    if (col.name === orderBy()) {
      setReverse(!reverse())
    } else {
      batch(() => {
        setOrderBy(col.name as OrderBy)
        setReverse(false)
      })
    }
  }
  const itemProps = (col: Col) => {
    return {
      fontWeight: "bold",
      fontSize: "$sm",
      color: "$neutral11",
      textAlign: col.textAlign as any,
      cursor: "pointer",
      onClick: () => onSort(col),
    }
  }
  // Direction indicator on the active sort column: one up-arrow that rotates to a
  // down-arrow via a CSS transform transition (GPU-driven, can't throw — no JS
  // animation lib needed for a 180° flip). reverse=false → ascending (↑).
  const SortArrow = (p: { col: Col }) => (
    <Show when={p.col.name === orderBy()}>
      <Box
        display="inline-flex"
        alignItems="center"
        color="$accent10"
        style={{
          transition: "transform 0.18s ease",
          transform: reverse() ? "rotate(180deg)" : "rotate(0deg)",
        }}
      >
        <AiOutlineArrowUp size={14} />
      </Box>
    </Show>
  )
  // Compact header: the selection controls stay on the left and the three sort
  // keys collapse into chips on the right, so they no longer pretend to be
  // column labels for a layout that has no columns.
  const SortChip = (p: { col: Col }) => (
    <HStack
      spacing="$0_5"
      px="$1_5"
      py="$0_5"
      rounded="$sm"
      cursor="pointer"
      fontSize="$xs"
      fontWeight="$medium"
      color={p.col.name === orderBy() ? "$accent11" : "$neutral10"}
      bgColor={p.col.name === orderBy() ? "$accent3" : "transparent"}
      _hover={{ bgColor: p.col.name === orderBy() ? "$accent3" : "$neutral4" }}
      onClick={() => onSort(p.col)}
    >
      <Text>{t(`home.obj.${p.col.name}`)}</Text>
      <SortArrow col={p.col} />
    </HStack>
  )

  if (props.compact) {
    return (
      <HStack
        class="title title-compact"
        w="$full"
        px="$2"
        py="$1"
        spacing="$2"
      >
        <Show when={!props.disableCheckbox && checkboxOpen()}>
          <ItemCheckbox
            checked={allChecked()}
            indeterminate={isIndeterminate()}
            onChange={(e: any) => {
              selectAll(e.target.checked as boolean)
            }}
          />
        </Show>
        <Show when={selectedMsg()}>
          <Text fontSize="$xs" color="$neutral11">
            {selectedMsg()}
          </Text>
        </Show>
        <Box flex={1} />
        <SortChip col={cols[0]} />
        <SortChip col={cols[1]} />
        <SortChip col={cols[2]} />
      </HStack>
    )
  }

  return (
    <HStack class="title" w="$full" p="$2">
      <HStack w={cols[0].w} spacing="$1">
        <Show when={!props.disableCheckbox && checkboxOpen()}>
          <ItemCheckbox
            checked={allChecked()}
            indeterminate={isIndeterminate()}
            onChange={(e: any) => {
              selectAll(e.target.checked as boolean)
            }}
          />
        </Show>
        {selectedMsg() ? (
          <Text {...itemProps(cols[0])}>{selectedMsg()}</Text>
        ) : (
          <>
            <Text {...itemProps(cols[0])}>{t(`home.obj.${cols[0].name}`)}</Text>
            <SortArrow col={cols[0]} />
          </>
        )}
      </HStack>
      <HStack
        w={cols[1].w}
        spacing="$1"
        justifyContent="flex-end"
        cursor="pointer"
        onClick={() => onSort(cols[1])}
      >
        <Text fontWeight="bold" fontSize="$sm" color="$neutral11">
          {t(`home.obj.${cols[1].name}`)}
        </Text>
        <SortArrow col={cols[1]} />
      </HStack>
      <HStack
        w={cols[2].w}
        spacing="$1"
        justifyContent="flex-end"
        cursor="pointer"
        onClick={() => onSort(cols[2])}
        display={{ "@initial": "none", "@md": "flex" }}
      >
        <Text fontWeight="bold" fontSize="$sm" color="$neutral11">
          {t(`home.obj.${cols[2].name}`)}
        </Text>
        <SortArrow col={cols[2]} />
      </HStack>
    </HStack>
  )
}

const ListLayout = () => {
  const { pathname } = useRouter()

  // The toolbar's sort menu writes the same state, so the header follows it.
  const saved = createMemo(() => loadSortState(pathname()))

  const { registerSelectContainer } = useSelectWithMouse()
  registerSelectContainer()

  // Media rows are chosen from the driver *and* the directory's actual contents —
  // see ./row-layout for why the provider alone isn't enough.
  const useMediaRows = createMemo(() =>
    shouldUseMediaRows(objStore.provider, objStore.objs),
  )

  // Long directories in "all" mode only render what is near the viewport.
  const pagerType = getPagination().type
  const virtual = createMemo(() =>
    shouldVirtualize(pagerType, objStore.objs.length),
  )
  const renderRow = (obj: StoreObj, index: number) => (
    <Show when={useMediaRows()} fallback={<ListItem obj={obj} index={index} />}>
      <MediaListItem obj={obj} index={index} />
    </Show>
  )

  const onDragOver = (e: DragEvent) => {
    const items = Array.from(e.dataTransfer?.items ?? [])
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (item.kind === "file") {
        bus.emit("tool", "upload")
        e.preventDefault()
        break
      }
    }
  }

  return (
    <VStack
      onDragOver={onDragOver}
      class="list viselect-container"
      w="$full"
      spacing="$1"
    >
      <ListTitle
        sortCallback={sortObjs}
        initialOrder={saved()?.orderBy as OrderBy | undefined}
        initialReverse={saved()?.reverse}
        compact={useMediaRows()}
      />
      <Show
        when={virtual()}
        fallback={
          <For each={objStore.objs}>{(obj, i) => renderRow(obj, i())}</For>
        }
      >
        <VirtualRows
          count={objStore.objs.length}
          estimate={rowEstimate(phoneShell(), useMediaRows())}
          gap={4}
          render={(i) => (
            <Show when={objStore.objs[i]} keyed>
              {(obj) => renderRow(obj, i)}
            </Show>
          )}
        />
      </Show>
      <Show when={local["show_count_msg"] === "visible"}>
        <Text size="sm" color="$neutral11">
          {countMsg()}
        </Text>
      </Show>
    </VStack>
  )
}

export default ListLayout
