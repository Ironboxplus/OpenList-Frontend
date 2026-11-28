import { createMemo, For, JSXElement, mergeProps, Show } from "solid-js"
import { Button } from "~/components/ui/button"
import { SimpleSelect } from "~/components/ui/simple-select"
import { cn } from "~/utils/cn"
import { createStore } from "solid-js/store"
import { FaSolidAngleLeft, FaSolidAngleRight } from "solid-icons/fa"

export interface PaginatorProps {
  defaultCurrent?: number
  onChange?: (current: number) => void
  hideOnSinglePage?: boolean
  total: number
  defaultPageSize?: number
  maxShowPage?: number
  setResetCallback?: (callback: () => void) => void
}
export const Paginator = (props: PaginatorProps) => {
  const merged = mergeProps(
    {
      maxShowPage: 4,
      defaultPageSize: 30,
      defaultCurrent: 1,
      hideOnSinglePage: true,
    },
    props,
  )
  const [store, setStore] = createStore({
    pageSize: merged.defaultPageSize,
    current: merged.defaultCurrent,
  })
  merged.setResetCallback?.(() => {
    setStore("current", merged.defaultCurrent)
  })
  const pages = createMemo(() => {
    return Math.ceil(merged.total / store.pageSize)
  })
  const leftPages = createMemo(() => {
    const current = store.current
    const min = Math.max(2, current - Math.floor(merged.maxShowPage / 2))
    return Array.from({ length: current - min }, (_, i) => min + i)
  })
  const rightPages = createMemo(() => {
    const current = store.current
    const max = Math.min(
      pages() - 1,
      current + Math.floor(merged.maxShowPage / 2),
    )
    return Array.from({ length: max - current }, (_, i) => current + 1 + i)
  })
  const allPages = createMemo(() => {
    return Array.from({ length: pages() }, (_, i) => 1 + i)
  })
  const onPageChange = (page: number) => {
    setStore("current", page)
    merged.onChange?.(page)
  }
  // hope's responsive sm / md sizes: 32px, 40px on a wide screen
  const btn = "h-8 md:h-10"
  const numberButton = (page: number) => (
    <Button
      variant="subtle"
      class={cn(btn, page > 10 ? "px-2.5" : "px-3")}
      onClick={() => {
        onPageChange(page)
      }}
    >
      {page}
    </Button>
  )
  const arrowButton = (label: string, to: () => number, icon: JSXElement) => (
    <Button
      variant="subtle"
      class={cn(btn, "w-8 px-0")}
      aria-label={label}
      onClick={() => {
        onPageChange(to())
      }}
    >
      {icon}
    </Button>
  )
  return (
    <Show when={!merged.hideOnSinglePage || pages() > 1}>
      <div class="flex flex-row items-center gap-x-1">
        <Show when={store.current !== 1}>
          {numberButton(1)}
          {arrowButton(
            "Previous",
            () => store.current - 1,
            <FaSolidAngleLeft />,
          )}
        </Show>
        <For each={leftPages()}>{(page) => numberButton(page)}</For>
        <SimpleSelect
          class={cn(btn, "w-auto gap-1 px-2")}
          aria-label="Page"
          options={allPages().map((p) => ({
            value: String(p),
            label: String(p),
          }))}
          value={String(store.current)}
          onChange={(page) => onPageChange(+page)}
        />
        <For each={rightPages()}>{(page) => numberButton(page)}</For>
        <Show when={store.current !== pages()}>
          {arrowButton("Next", () => store.current + 1, <FaSolidAngleRight />)}
          {numberButton(pages())}
        </Show>
      </div>
    </Show>
  )
}
