import { fireEvent, render, screen } from "@solidjs/testing-library"
import { TbFolder } from "solid-icons/tb"
import { createSignal } from "solid-js"
import { describe, expect, it, vi } from "vitest"
import { CommandPaletteView, type PaletteLabels } from "../CommandPaletteView"
import type { PaletteItem } from "../items"

const labels: PaletteLabels = {
  title: "Command palette",
  placeholder: "Search",
  empty: (q) => `Nothing for ${q}`,
  count: (n) => `${n} results`,
  group: {
    recent: "Recent",
    nav: "Page",
    setting: "Setting",
    action: "Action",
  },
  close: "Close",
}

const make = (
  id: string,
  title: string,
  keywords: string[] = [],
  group: PaletteItem["group"] = "nav",
) =>
  ({
    id,
    title,
    keywords,
    group,
    icon: TbFolder,
    run: vi.fn(),
  }) satisfies PaletteItem

const files = make("nav:files", "Files", ["文件"])
const traffic = make(
  "setting:traffic",
  "Traffic",
  ["限速", "bandwidth"],
  "setting",
)
const sync = make("action:new-sync", "New sync job", ["同步", "sync"], "action")
const transfers = make("nav:transfers", "Transfers", ["传输"])
// Settings only show up once something is typed.
const items: PaletteItem[] = [files, transfers, traffic, sync]

const setup = (over: { recentIds?: string[]; phone?: boolean } = {}) => {
  const onRun = vi.fn()
  const onOpenChange = vi.fn()
  const view = render(() => (
    <CommandPaletteView
      open
      onOpenChange={onOpenChange}
      items={items}
      recentIds={over.recentIds ?? []}
      onRun={onRun}
      phone={over.phone ?? false}
      labels={labels}
    />
  ))
  return { view, onRun, onOpenChange }
}

const input = () => screen.getByRole("combobox")
const options = () => screen.getAllByRole("option")
const activeId = () => input().getAttribute("aria-activedescendant")

describe("CommandPaletteView semantics", () => {
  it("is a combobox over a listbox and starts on the first option", () => {
    setup()
    const list = screen.getByRole("listbox")
    expect(input().getAttribute("aria-controls")).toBe(list.id)
    expect(input().getAttribute("aria-expanded")).toBe("true")
    expect(activeId()).toBe(options()[0].id)
    expect(options()[0].getAttribute("aria-selected")).toBe("true")
    expect(options()[1].getAttribute("aria-selected")).toBe("false")
  })

  it("announces the result count", () => {
    setup()
    expect(screen.getByRole("status").textContent).toBe("3 results")
  })

  it("uses a dialog on larger screens and a sheet on phones", () => {
    const a = setup()
    expect(document.querySelector('[data-palette="dialog"]')).toBeTruthy()
    a.view.unmount()
    setup({ phone: true })
    expect(document.querySelector('[data-palette="sheet"]')).toBeTruthy()
    expect(screen.getByRole("button", { name: "Close" })).toBeTruthy()
  })
})

describe("CommandPaletteView keyboard", () => {
  it("moves with the arrow keys and wraps both ways", () => {
    setup()
    const ids = options().map((o) => o.id)
    expect(ids).toHaveLength(3)
    fireEvent.keyDown(input(), { key: "ArrowDown" })
    expect(activeId()).toBe(ids[1])
    fireEvent.keyDown(input(), { key: "ArrowDown" })
    fireEvent.keyDown(input(), { key: "ArrowDown" })
    expect(activeId()).toBe(ids[0])
    fireEvent.keyDown(input(), { key: "ArrowUp" })
    expect(activeId()).toBe(ids[2])
  })

  it("Home and End jump to the ends", () => {
    setup()
    const ids = options().map((o) => o.id)
    fireEvent.keyDown(input(), { key: "End" })
    expect(activeId()).toBe(ids[2])
    fireEvent.keyDown(input(), { key: "Home" })
    expect(activeId()).toBe(ids[0])
  })

  it("Enter runs the active option and closes first", () => {
    const { onRun, onOpenChange } = setup()
    fireEvent.keyDown(input(), { key: "ArrowDown" })
    fireEvent.keyDown(input(), { key: "Enter" })
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(onRun).toHaveBeenCalledWith(transfers)
  })

  it("does not run while an IME is composing", () => {
    const { onRun } = setup()
    fireEvent.keyDown(input(), { key: "Enter", isComposing: true })
    expect(onRun).not.toHaveBeenCalled()
  })

  it("Escape closes through the dialog", () => {
    const { onOpenChange } = setup()
    fireEvent.keyDown(input(), { key: "Escape" })
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("clicking an option runs it", () => {
    const { onRun } = setup()
    fireEvent.click(options()[2])
    expect(onRun).toHaveBeenCalledWith(sync)
  })
})

describe("CommandPaletteView search", () => {
  it("filters and ranks as you type, and resets the selection to the top", () => {
    setup()
    fireEvent.keyDown(input(), { key: "ArrowDown" })
    fireEvent.input(input(), { target: { value: "限速" } })
    const opts = options()
    expect(opts).toHaveLength(1)
    expect(opts[0].getAttribute("data-palette-id")).toBe("setting:traffic")
    expect(activeId()).toBe(opts[0].id)
    expect(screen.getByRole("status").textContent).toBe("1 results")
  })

  it("Enter after typing runs the best match", () => {
    const { onRun } = setup()
    fireEvent.input(input(), { target: { value: "同步" } })
    fireEvent.keyDown(input(), { key: "Enter" })
    expect(onRun).toHaveBeenCalledWith(sync)
  })

  it("explains an empty result and has no active descendant", () => {
    setup()
    fireEvent.input(input(), { target: { value: "zzzzqq" } })
    expect(screen.queryAllByRole("option")).toHaveLength(0)
    expect(screen.getByText("Nothing for zzzzqq")).toBeTruthy()
    expect(input().getAttribute("aria-activedescendant")).toBeNull()
    fireEvent.keyDown(input(), { key: "ArrowDown" })
    fireEvent.keyDown(input(), { key: "Enter" })
  })

  it("shows recent items first on an empty query and tags them", () => {
    setup({ recentIds: ["setting:traffic"] })
    const opts = options()
    expect(opts[0].getAttribute("data-palette-id")).toBe("setting:traffic")
    expect(opts[0].textContent).toContain("Recent")
    expect(opts.map((o) => o.getAttribute("data-palette-id"))).toEqual([
      "setting:traffic",
      "nav:files",
      "nav:transfers",
      "action:new-sync",
    ])
  })
})

describe("CommandPaletteView reopening", () => {
  it("starts from a clean query each time it opens", () => {
    const [open, setOpen] = createSignal(true)
    render(() => (
      <CommandPaletteView
        open={open()}
        onOpenChange={setOpen}
        items={items}
        recentIds={[]}
        onRun={() => {}}
        phone={false}
        labels={labels}
      />
    ))
    fireEvent.input(input(), { target: { value: "sync" } })
    expect(options()).toHaveLength(1)
    setOpen(false)
    setOpen(true)
    expect((input() as HTMLInputElement).value).toBe("")
    expect(options()).toHaveLength(3)
  })
})

describe("CommandPaletteView extra items", () => {
  it("adds the entries made for the typed text after the matches, and not for an empty query", () => {
    const search = make(
      "action:search-files",
      "Search files for x",
      [],
      "action",
    )
    const extra = vi.fn((q: string) => (q ? [search] : []))
    const onRun = vi.fn()
    render(() => (
      <CommandPaletteView
        open
        onOpenChange={() => {}}
        items={items}
        recentIds={[]}
        onRun={onRun}
        phone={false}
        labels={labels}
        extraItems={extra}
      />
    ))
    expect(screen.queryByText("Search files for x")).toBeNull()
    fireEvent.input(input(), { target: { value: "zzzz-no-match" } })
    expect(options()).toHaveLength(1)
    fireEvent.keyDown(input(), { key: "Enter" })
    expect(onRun).toHaveBeenCalledWith(search)
    expect(extra).toHaveBeenCalledWith("zzzz-no-match")
  })
})
