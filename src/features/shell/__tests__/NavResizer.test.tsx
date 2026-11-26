import { fireEvent, render, screen } from "@solidjs/testing-library"
import { createSignal } from "solid-js"
import { describe, expect, it } from "vitest"
import { NavResizer } from "../NavResizer"

// Dragging is covered in a real browser (scripts/ui-compare/bugs.mjs, nav-resize-*).
const setup = (initial = 220, max = 720) => {
  const [width, setWidth] = createSignal(initial)
  const calls: [number, boolean][] = []
  render(() => (
    <NavResizer
      width={width()}
      max={max}
      label="Resize sidebar"
      controls="nav"
      onResize={(w, done) => {
        calls.push([w, done])
        setWidth(w)
      }}
    />
  ))
  return { handle: screen.getByRole("separator"), width, calls }
}

describe("NavResizer", () => {
  it("is a window splitter with its value in px", () => {
    const { handle } = setup(300)
    expect(handle.getAttribute("aria-orientation")).toBe("vertical")
    expect(handle.getAttribute("aria-label")).toBe("Resize sidebar")
    expect(handle.getAttribute("aria-controls")).toBe("nav")
    expect(handle.getAttribute("aria-valuenow")).toBe("300")
    expect(handle.getAttribute("aria-valuemin")).toBe("220")
    expect(handle.getAttribute("aria-valuemax")).toBe("720")
    expect(handle.tabIndex).toBe(0)
  })

  it("follows the arrow keys, Home and End, within its limits", () => {
    const { handle, width, calls } = setup()
    fireEvent.keyDown(handle, { key: "ArrowRight" })
    fireEvent.keyDown(handle, { key: "ArrowRight" })
    expect(width()).toBe(252)
    fireEvent.keyDown(handle, { key: "ArrowLeft" })
    expect(width()).toBe(236)
    fireEvent.keyDown(handle, { key: "End" })
    expect(width()).toBe(720)
    fireEvent.keyDown(handle, { key: "ArrowRight" })
    expect(width()).toBe(720)
    fireEvent.keyDown(handle, { key: "Home" })
    expect(width()).toBe(220)
    fireEvent.keyDown(handle, { key: "ArrowLeft" })
    expect(width()).toBe(220)
    // every key press is kept
    expect(calls.every(([, done]) => done)).toBe(true)
    expect(handle.getAttribute("aria-valuenow")).toBe("220")
  })

  it("ignores other keys", () => {
    const { handle, calls } = setup(300)
    fireEvent.keyDown(handle, { key: "a" })
    fireEvent.keyDown(handle, { key: "Enter" })
    expect(calls).toEqual([])
  })

  it("returns to the default on double click", () => {
    const { handle, width, calls } = setup(480)
    fireEvent.dblClick(handle)
    expect(width()).toBe(220)
    expect(calls).toEqual([[220, true]])
  })
})
