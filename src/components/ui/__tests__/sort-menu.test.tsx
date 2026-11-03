import { cleanup, fireEvent, render } from "@solidjs/testing-library"
import { afterEach, describe, expect, it, vi } from "vitest"
import { DropdownMenu, DropdownMenuContent } from "../dropdown-menu"
import { SortMenuItems } from "../sort-menu"

afterEach(cleanup)

const labels = { by: "By", asc: "Asc", desc: "Desc" }
const options = [{ key: "name", label: "Name" }]

const mount = (value: string | undefined) => {
  const onChange = vi.fn()
  const onReset = vi.fn()
  render(() => (
    <DropdownMenu open>
      <DropdownMenuContent>
        <SortMenuItems
          options={options}
          value={value}
          reverse={false}
          labels={labels}
          onChange={onChange}
          defaultLabel="Default (storage order)"
          onReset={onReset}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  ))
  const item = (k: string) =>
    document.querySelector(`[data-sort-key=${k}]`) as HTMLElement
  return { onChange, onReset, item }
}

describe("SortMenuItems default item", () => {
  it("is the active one when nothing is remembered", () => {
    const { item } = mount(undefined)
    expect(item("default").getAttribute("aria-checked")).toBe("true")
    expect(item("name").getAttribute("aria-checked")).toBe("false")
  })

  it("is not active once a key is chosen, and picking it resets", () => {
    const { item, onReset, onChange } = mount("name")
    expect(item("default").getAttribute("aria-checked")).toBe("false")
    expect(item("name").getAttribute("aria-checked")).toBe("true")
    item("default").focus()
    fireEvent.keyDown(item("default"), { key: "Enter" })
    expect(onReset).toHaveBeenCalledTimes(1)
    expect(onChange).not.toHaveBeenCalled()
  })
})
