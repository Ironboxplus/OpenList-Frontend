import { fireEvent, render, screen } from "@solidjs/testing-library"
import { HopeProvider } from "@hope-ui/solid"
import { createSignal } from "solid-js"
import { describe, expect, it, vi } from "vitest"

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

// The folder choosers are hope-ui widgets with their own tests; stand in plain inputs.
vi.mock("~/components/FolderTree", () => ({
  FolderChooseInput: (p: {
    id?: string
    value: string
    onChange: (v: string) => void
    onlyFolder?: boolean
  }) => (
    <input
      id={p.id}
      data-picker={p.onlyFolder ? "folder" : "path"}
      value={p.value}
      onInput={(e) => p.onChange(e.currentTarget.value)}
    />
  ),
}))
vi.mock("~/components/MultiPathInput", () => ({
  MultiPathInput: (p: {
    id?: string
    value: string
    onChange: (v: string) => void
    basePath?: string
  }) => (
    <textarea
      id={p.id}
      data-base={p.basePath}
      value={p.value}
      onInput={(e) => p.onChange(e.currentTarget.value)}
    />
  ),
}))

import { Type } from "~/types"
import { FieldRenderer } from "../FieldRenderer"
import type { FieldRaw, FieldSpec, FieldValue } from "../field"

const base = (over: Partial<FieldSpec>): FieldSpec => ({
  id: "f",
  type: Type.String,
  labelKey: "global.name",
  ...over,
})

/** Renders a field bound to local state and records what it emitted. */
const mount = (spec: FieldSpec, initial: FieldValue, extra = {}) => {
  const emitted: FieldRaw[] = []
  render(() => {
    const [value, setValue] = createSignal<FieldValue>(initial)
    return (
      <HopeProvider>
        <FieldRenderer
          field={spec}
          value={value()}
          onChange={(raw) => {
            emitted.push(raw)
            setValue(Array.isArray(raw) ? raw : (raw as FieldValue))
          }}
          {...extra}
        />
      </HopeProvider>
    )
  })
  return emitted
}

const type = (el: Element, value: string) => {
  ;(el as HTMLInputElement).value = value
  fireEvent.input(el)
}

describe("FieldRenderer", () => {
  it("shows label, required mark and help, linked to the control", () => {
    mount(base({ required: true, helpKey: "global.refresh" }), "x")
    const label = screen.getByText("Name", { selector: "label" })
    expect(label.getAttribute("for")).toBe("f")
    expect(label.textContent).toContain("*")
    expect(screen.getByText("Refresh")).toBeTruthy()
    expect(document.getElementById("f")).toBeTruthy()
  })

  it("string: emits what is typed; read-only fields cannot be edited", () => {
    const out = mount(base({}), "a")
    type(document.getElementById("f")!, "abc")
    expect(out).toEqual(["abc"])
    document.body.innerHTML = ""
    mount(base({ readonly: true }), "ro")
    expect((document.getElementById("f") as HTMLInputElement).readOnly).toBe(
      true,
    )
  })

  it("password-like strings are masked", () => {
    mount(base({ secret: true }), "pw")
    expect((document.getElementById("f") as HTMLInputElement).type).toBe(
      "password",
    )
  })

  it("number and float use numeric inputs and emit the raw text", () => {
    const out = mount(base({ type: Type.Number }), 5)
    const el = document.getElementById("f") as HTMLInputElement
    expect(el.type).toBe("number")
    expect(el.value).toBe("5")
    type(el, "12")
    expect(out).toEqual(["12"])
    document.body.innerHTML = ""
    mount(base({ type: Type.Float }), 1.5)
    const fl = document.getElementById("f") as HTMLInputElement
    expect(fl.step).toBe("any")
    expect(fl.value).toBe("1.5")
  })

  it("an emptied number (NaN) shows an empty box, not the word NaN", () => {
    mount(base({ type: Type.Number }), NaN)
    expect((document.getElementById("f") as HTMLInputElement).value).toBe("")
  })

  it("text is a textarea", () => {
    const out = mount(base({ type: Type.Text }), "line")
    const el = document.getElementById("f") as HTMLTextAreaElement
    expect(el.tagName).toBe("TEXTAREA")
    type(el, "a\nb")
    expect(out).toEqual(["a\nb"])
  })

  it("bool is a switch that emits booleans", () => {
    const out = mount(base({ type: Type.Bool }), false)
    const box =
      document.getElementById("f-input") ?? document.getElementById("f")!
    fireEvent.click(box)
    expect(out).toEqual([true])
  })

  it("select shows option text from the i18n prefix and emits the value", async () => {
    const out = mount(
      base({
        type: Type.Select,
        options: [
          { value: "asc", labelKey: "shares.order_directions.asc" },
          { value: "desc", labelKey: "shares.order_directions.desc" },
        ],
      }),
      "asc",
    )
    expect(document.body.textContent).toContain("Ascending")
    const trigger = document.getElementById("f")!
    fireEvent.keyDown(trigger, { key: "Enter" })
    await new Promise((r) => setTimeout(r, 20))
    const desc = [...document.querySelectorAll("[role=option]")].find(
      (o) => o.textContent === "Descending",
    )!
    fireEvent.click(desc)
    await new Promise((r) => setTimeout(r, 20))
    expect(out).toEqual(["desc"])
  })

  it("searchable select filters while typing and emits the picked value", async () => {
    const out = mount(
      base({
        type: Type.Select,
        searchable: true,
        options: [
          { value: "Local", label: "Local storage" },
          { value: "S3", label: "S3 object storage" },
          { value: "Ali", label: "Aliyun Drive" },
        ],
      }),
      "Local",
    )
    const input = document.getElementById("f") as HTMLInputElement
    expect(input.value).toBe("Local storage")
    fireEvent.focus(input)
    fireEvent.click(input)
    await new Promise((r) => setTimeout(r, 20))
    const shown = () =>
      [...document.querySelectorAll("[role=option]")].map((o) => o.textContent)
    expect(shown()).toHaveLength(3)
    type(input, "drive")
    await new Promise((r) => setTimeout(r, 20))
    expect(shown()).toEqual(["Aliyun Drive"])
    fireEvent.click(document.querySelector("[role=option]")!)
    await new Promise((r) => setTimeout(r, 20))
    expect(out).toEqual(["Ali"])
  })

  it("multiple select emits the list of chosen values", async () => {
    const out = mount(
      base({
        type: Type.Select,
        multiple: true,
        options: [
          { value: "1", label: "alice" },
          { value: "2", label: "bob" },
        ],
      }),
      ["1"],
    )
    expect(document.body.textContent).toContain("alice")
    fireEvent.keyDown(document.getElementById("f")!, { key: "Enter" })
    await new Promise((r) => setTimeout(r, 20))
    const bob = [...document.querySelectorAll("[role=option]")].find(
      (o) => o.textContent === "bob",
    )!
    fireEvent.click(bob)
    await new Promise((r) => setTimeout(r, 20))
    expect(out).toEqual([["1", "2"]])
  })

  it("a deprecated setting offers delete; others do not", () => {
    const onDelete = vi.fn()
    mount(base({ deprecated: true }), "x", { onDelete })
    fireEvent.click(screen.getByLabelText("Delete"))
    expect(onDelete).toHaveBeenCalledTimes(1)
    document.body.innerHTML = ""
    mount(base({}), "x", { onDelete })
    expect(screen.queryByLabelText("Delete")).toBeNull()
  })

  it("generate fills the field with a fresh value", () => {
    const out = mount(base({ generate: () => "NEWVAL" }), "")
    fireEvent.click(screen.getByLabelText("Generate a random value"))
    expect(out).toEqual(["NEWVAL"])
  })

  it("paths use the folder chooser, multi paths the multi path input", () => {
    const out = mount(base({ picker: "folder" }), "/a")
    const el = document.getElementById("f")!
    expect(el.getAttribute("data-picker")).toBe("folder")
    type(el, "/b")
    expect(out).toEqual(["/b"])
    document.body.innerHTML = ""
    mount(base({ type: Type.MultiPath, basePath: "/home" }), "/x")
    expect(document.getElementById("f")!.getAttribute("data-base")).toBe(
      "/home",
    )
  })

  it("an unknown type says so instead of rendering nothing", () => {
    mount(base({ type: "weird" as Type }), "")
    expect(document.body.textContent).toContain("Unknown type")
  })
})
