import { createWindowVirtualizer } from "@tanstack/solid-virtual"
import { createSignal, For, type JSX, onCleanup, onMount } from "solid-js"
import { setVirtualScroller } from "./scroll-to"

/**
 * Renders only the rows near the viewport of a very long list. The window is
 * the scroll container (like the rest of the app), so the list's offset from
 * the top of the document is tracked and handed to the virtualizer.
 *
 * Rows are absolutely positioned, which keeps the DOM small, but the data and
 * every selection operation stay in the store and work on all items.
 */
export const VirtualRows = (props: {
  count: number
  /** Initial height guess per row (px); real heights are measured. */
  estimate: number
  gap?: number
  render: (index: number) => JSX.Element
  /** Called with the container so callers can read its width. */
  ref?: (el: HTMLDivElement) => void
}) => {
  let el!: HTMLDivElement
  const [margin, setMargin] = createSignal(0)
  const measureMargin = () =>
    setMargin(el.getBoundingClientRect().top + window.scrollY)

  const virtualizer = createWindowVirtualizer<HTMLDivElement>({
    get count() {
      return props.count
    },
    get estimateSize() {
      const e = props.estimate
      return () => e
    },
    get gap() {
      return props.gap ?? 0
    },
    get scrollMargin() {
      return margin()
    },
    overscan: 8,
  })

  onMount(() => {
    measureMargin()
    // Content above the list (README, announcement, status card) can change
    // height after first paint; the body size reflects that.
    const ro = new ResizeObserver(measureMargin)
    ro.observe(document.body)
    onCleanup(() => ro.disconnect())
    setVirtualScroller((index) =>
      virtualizer.scrollToIndex(index, { align: "center" }),
    )
    onCleanup(() => setVirtualScroller(undefined))
  })

  // Arrow keys move focus between rows; a row that is not mounted yet is
  // scrolled into existence first.
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return
    const row = (e.target as HTMLElement).closest<HTMLElement>(".viselect-item")
    if (!row) return
    const next = Number(row.dataset.index) + (e.key === "ArrowDown" ? 1 : -1)
    if (next < 0 || next >= props.count) return
    e.preventDefault()
    virtualizer.scrollToIndex(next, { align: "auto" })
    let frames = 30
    const focus = () => {
      const target = el.querySelector<HTMLElement>(
        `.viselect-item[data-index="${next}"]`,
      )
      if (target) target.focus()
      else if (frames-- > 0) requestAnimationFrame(focus)
    }
    requestAnimationFrame(focus)
  }

  return (
    <div
      ref={(node) => {
        el = node
        props.ref?.(node)
      }}
      data-virtual-rows
      style={{
        position: "relative",
        width: "100%",
        height: `${virtualizer.getTotalSize()}px`,
      }}
      onKeyDown={onKeyDown}
    >
      <For each={virtualizer.getVirtualItems()}>
        {(item) => (
          <div
            data-index={item.index}
            ref={(node) =>
              queueMicrotask(() => virtualizer.measureElement(node))
            }
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              transform: `translateY(${item.start - margin()}px)`,
            }}
          >
            {props.render(item.index)}
          </div>
        )}
      </For>
    </div>
  )
}
