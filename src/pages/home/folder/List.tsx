import { Box, HStack, VStack, Text } from "@hope-ui/solid"
import { batch, createEffect, createSignal, For, Show, onMount } from "solid-js"
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
} from "~/store"
import { OrderBy } from "~/store"
import { Col, cols, ListItem } from "./ListItem"
import { ItemCheckbox, useSelectWithMouse } from "./helper"
import { bus } from "~/utils"

export interface SortState {
  orderBy: string
  reverse: boolean
}

const SORT_KEY_PREFIX = "dir_sort_"

export function saveSortState(dir: string, state: SortState) {
  try {
    localStorage.setItem(`${SORT_KEY_PREFIX}${dir}`, JSON.stringify(state))
  } catch (err) {
    console.warn("failed to save sort config:", err)
  }
}

export function loadSortState(dir: string): SortState | null {
  try {
    const item = localStorage.getItem(`${SORT_KEY_PREFIX}${dir}`)
    if (!item) return null
    return JSON.parse(item) as SortState
  } catch (err) {
    console.warn("failed to read sort config:", err)
    return null
  }
}

export const ListTitle = (props: {
  sortCallback: (orderBy: OrderBy, reverse?: boolean) => void
  disableCheckbox?: boolean
  initialOrder?: OrderBy
  initialReverse?: boolean
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

  const [initialOrder, setInitialOrder] = createSignal<OrderBy>()
  const [initialReverse, setInitialReverse] = createSignal(false)

  const { registerSelectContainer, captureContentMenu } = useSelectWithMouse()
  registerSelectContainer()

  onMount(() => {
    const saved = loadSortState(pathname())
    if (saved) {
      setInitialOrder(saved.orderBy as OrderBy)
      setInitialReverse(saved.reverse)
      sortObjs(saved.orderBy as OrderBy, saved.reverse)
    }
  })

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
      oncapture:contextmenu={captureContentMenu}
      class="list viselect-container"
      w="$full"
      spacing="$1"
    >
      <ListTitle
        sortCallback={sortObjs}
        initialOrder={initialOrder()}
        initialReverse={initialReverse()}
      />
      <For each={objStore.objs}>
        {(obj, i) => {
          return <ListItem obj={obj} index={i()} />
        }}
      </For>
      <Show when={local["show_count_msg"] === "visible"}>
        <Text size="sm" color="$neutral11">
          {countMsg()}
        </Text>
      </Show>
    </VStack>
  )
}

export default ListLayout
