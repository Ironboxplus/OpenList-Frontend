import { fireEvent, render } from "@solidjs/testing-library"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("~/hooks", async () => {
  const i18n = await import("@solid-primitives/i18n")
  const { dict } = await import("~/lang/en/entry")
  const flat = i18n.flatten(dict) as unknown as Record<string, string>
  return {
    useT: () => (key: string, params?: Record<string, string | number>) => {
      const tpl = flat[key]
      if (typeof tpl !== "string") return key
      return params ? i18n.resolveTemplate(tpl, params) : tpl
    },
  }
})

import { ResourceList, type ResourceListProps } from "../ResourceList"

interface Row {
  id: number
  name: string
  size: number
}
const ROWS: Row[] = [
  { id: 1, name: "bravo", size: 30 },
  { id: 2, name: "alpha", size: 10 },
  { id: 3, name: "charlie", size: 20 },
]

const setWidth = (w: number) => {
  Object.defineProperty(window, "innerWidth", { value: w, configurable: true })
}
afterEach(() => setWidth(1024))

const props = (
  over: Partial<ResourceListProps<Row>> = {},
): ResourceListProps<Row> => ({
  rows: ROWS,
  rowKey: (r) => r.id,
  columns: [
    { id: "name", header: "Name", cell: (r) => r.name, sort: (r) => r.name },
    {
      id: "size",
      header: "Size",
      cell: (r) => String(r.size),
      sort: (r) => r.size,
    },
  ],
  card: { title: (r) => r.name, body: (r) => `size ${r.size}` },
  ...over,
})

const names = () =>
  [...document.querySelectorAll("[data-row]")].map(
    (r) => r.textContent!.match(/alpha|bravo|charlie/)![0],
  )

const openMenu = async (row: number) => {
  const triggers = document.querySelectorAll("[data-testid=row-actions]")
  fireEvent.keyDown(triggers[row], { key: "Enter" })
  await new Promise((r) => setTimeout(r, 20))
}

describe("ResourceList", () => {
  it("desktop: a table with headers, one row per record", () => {
    setWidth(1280)
    const { container } = render(() => <ResourceList {...props()} />)
    expect(container.querySelector("[data-layout=table]")).toBeTruthy()
    expect(container.querySelector("[data-layout=cards]")).toBeNull()
    expect(container.querySelectorAll("thead th")).toHaveLength(3) // + operations
    expect(names()).toEqual(["bravo", "alpha", "charlie"])
  })

  it("phone: one card per record instead of a table", () => {
    setWidth(400)
    const { container } = render(() => <ResourceList {...props()} />)
    expect(container.querySelector("[data-layout=cards]")).toBeTruthy()
    expect(container.querySelector("table")).toBeNull()
    expect(container.querySelectorAll("[data-row]")).toHaveLength(3)
    expect(container.textContent).toContain("size 10")
  })

  it("tablet keeps the table", () => {
    setWidth(800)
    const { container } = render(() => <ResourceList {...props()} />)
    expect(container.querySelector("table")).toBeTruthy()
  })

  it("clicking a sortable header sorts ascending, descending, then restores", () => {
    setWidth(1280)
    const { getByText } = render(() => <ResourceList {...props()} />)
    fireEvent.click(getByText("Name"))
    expect(names()).toEqual(["alpha", "bravo", "charlie"])
    fireEvent.click(getByText("Name"))
    expect(names()).toEqual(["charlie", "bravo", "alpha"])
    fireEvent.click(getByText("Name"))
    expect(names()).toEqual(["bravo", "alpha", "charlie"])
    fireEvent.click(getByText("Size"))
    expect(names()).toEqual(["alpha", "charlie", "bravo"])
  })

  it("row menu runs the chosen action with its row", async () => {
    setWidth(1280)
    const onEdit = vi.fn()
    const onDelete = vi.fn()
    render(() => (
      <ResourceList
        {...props({
          actions: (r) => [
            { id: "edit", label: "Edit row", onSelect: onEdit },
            {
              id: "del",
              label: "Delete row",
              destructive: true,
              onSelect: onDelete,
            },
          ],
        })}
      />
    ))
    await openMenu(1)
    const del = [...document.querySelectorAll("[role=menuitem]")].find(
      (i) => i.textContent === "Delete row",
    )!
    fireEvent.keyDown(del, { key: "Enter" })
    await new Promise((r) => setTimeout(r, 20))
    expect(onDelete).toHaveBeenCalledWith(ROWS[1])
    expect(onEdit).not.toHaveBeenCalled()
  })

  it("a primary action is its own button, on both layouts", () => {
    const onEdit = vi.fn()
    const primary = () => ({ id: "edit", label: "Edit", onSelect: onEdit })
    setWidth(1280)
    const wide = render(() => <ResourceList {...props({ primary })} />)
    fireEvent.click(wide.getAllByText("Edit")[0])
    expect(onEdit).toHaveBeenCalledWith(ROWS[0])
    wide.unmount()
    setWidth(400)
    const narrow = render(() => <ResourceList {...props({ primary })} />)
    fireEvent.click(narrow.getAllByText("Edit")[2])
    expect(onEdit).toHaveBeenLastCalledWith(ROWS[2])
  })

  it("toolbar: create, disabled-with-hint and refresh", () => {
    const create = vi.fn()
    const refresh = vi.fn()
    const { getByText } = render(() => (
      <ResourceList
        {...props({
          onRefresh: refresh,
          toolbarActions: [
            { id: "add", label: "Create", onSelect: create },
            {
              id: "x",
              label: "Locked",
              onSelect: () => {},
              disabled: true,
              hint: "need permission",
            },
          ],
        })}
      />
    ))
    fireEvent.click(getByText("Create"))
    fireEvent.click(getByText("Refresh"))
    expect(create).toHaveBeenCalledTimes(1)
    expect(refresh).toHaveBeenCalledTimes(1)
    const locked = getByText("Locked").closest("button")!
    expect(locked.disabled).toBe(true)
    expect(locked.title).toBe("need permission")
  })

  it("empty, loading and error states replace the list", () => {
    const empty = render(() => (
      <ResourceList {...props({ rows: [], emptyText: "No rows" })} />
    ))
    expect(
      empty.container.querySelector("[data-state=empty]")?.textContent,
    ).toContain("No rows")
    empty.unmount()
    const loading = render(() => (
      <ResourceList {...props({ rows: [], loading: true })} />
    ))
    expect(loading.container.querySelector("[data-state=loading]")).toBeTruthy()
    loading.unmount()
    const retry = vi.fn()
    const failed = render(() => (
      <ResourceList
        {...props({ rows: [], error: "boom happened", onRefresh: retry })}
      />
    ))
    expect(
      failed.container.querySelector("[data-state=error]")?.textContent,
    ).toContain("boom happened")
    fireEvent.click(failed.getAllByText("Retry")[0])
    expect(retry).toHaveBeenCalled()
  })

  it("rows already loaded stay visible while a refresh runs", () => {
    setWidth(1280)
    const { container } = render(() => (
      <ResourceList {...props({ loading: true })} />
    ))
    expect(container.querySelector("[data-state=loading]")).toBeNull()
    expect(container.querySelectorAll("[data-row]")).toHaveLength(3)
  })
})
