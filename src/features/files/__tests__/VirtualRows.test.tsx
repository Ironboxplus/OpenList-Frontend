import { cleanup, fireEvent, render } from "@solidjs/testing-library"
import { createSignal, For } from "solid-js"
import { afterEach, beforeAll, describe, expect, it } from "vitest"
import { selectAllItems, initialSelection, toggleItem } from "../selection"
import { VirtualRows } from "../VirtualRows"

afterEach(cleanup)

beforeAll(() => {
  // jsdom has no layout; give the window a viewport and rows a height.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
  Object.defineProperty(window, "innerHeight", {
    value: 800,
    configurable: true,
  })
  Object.defineProperty(window, "innerWidth", {
    value: 1200,
    configurable: true,
  })
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
    configurable: true,
    get: () => 44,
  })
})

const TOTAL = 1000

const List = () => {
  const [sel, setSel] = createSignal(initialSelection)
  return (
    <div>
      <button
        data-testid="all"
        onClick={() => setSel(selectAllItems(sel(), TOTAL))}
      >
        all
      </button>
      <output data-testid="count">{sel().selected.size}</output>
      <VirtualRows
        count={TOTAL}
        estimate={44}
        render={(i) => (
          <div
            class="viselect-item"
            data-row={i}
            data-selected={sel().selected.has(i)}
            onClick={() => setSel(toggleItem(sel(), i))}
          >
            row {i}
          </div>
        )}
      />
    </div>
  )
}

describe("VirtualRows", () => {
  it("renders only the rows near the viewport for 1000 items", () => {
    const { container } = render(() => <List />)
    const rows = container.querySelectorAll("[data-row]")
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.length).toBeLessThan(60)
  })

  it("select-all selects all 1000 items although only a few are rendered", async () => {
    const { container, getByTestId } = render(() => <List />)
    await fireEvent.click(getByTestId("all"))
    expect(getByTestId("count").textContent).toBe("1000")
    expect(container.querySelectorAll("[data-row]").length).toBeLessThan(60)
    const first = container.querySelector("[data-row]") as HTMLElement
    expect(first.dataset.selected).toBe("true")
  })

  it("reserves the full scroll height for the unrendered rows", () => {
    const { container } = render(() => <List />)
    const box = container.querySelector("[data-virtual-rows]") as HTMLElement
    expect(parseInt(box.style.height, 10)).toBeGreaterThanOrEqual(TOTAL * 44)
  })

  it("lists rows for a short list in full", () => {
    const { container } = render(() => (
      <VirtualRows
        count={5}
        estimate={44}
        render={(i) => <For each={[i]}>{(n) => <p data-row={n}>{n}</p>}</For>}
      />
    ))
    expect(container.querySelectorAll("[data-row]").length).toBe(5)
  })
})
