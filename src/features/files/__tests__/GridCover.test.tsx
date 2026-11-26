import { fireEvent, render } from "@solidjs/testing-library"
import { createSignal } from "solid-js"
import { describe, expect, it } from "vitest"
import { GridCover } from "../GridCover"

const icon = <span data-testid="icon">icon</span>

describe("GridCover", () => {
  it("shows a lazy 2:3 poster when a cover URL is given", () => {
    const { container, queryByTestId } = render(() => (
      <GridCover src="/c.jpg" fallback={icon} alt="Movie" />
    ))
    const img = container.querySelector("img")!
    expect(img.getAttribute("src")).toBe("/c.jpg")
    expect(img.getAttribute("loading")).toBe("lazy")
    expect(img.getAttribute("alt")).toBe("Movie")
    expect(container.querySelector("[data-grid-cover]")!.className).toContain(
      "aspect-[2/3]",
    )
    expect(queryByTestId("icon")).toBeNull()
  })

  it("falls back to the icon without a cover", () => {
    const { container, getByTestId } = render(() => (
      <GridCover fallback={icon} />
    ))
    expect(container.querySelector("img")).toBeNull()
    expect(getByTestId("icon")).toBeTruthy()
  })

  it("draws the icon in the same 2:3 frame when the image fails to load", () => {
    // a failed poster made its card shorter than the rest of the row (audit m3)
    const { container, getByTestId } = render(() => (
      <GridCover src="/broken.jpg" fallback={icon} />
    ))
    fireEvent.error(container.querySelector("img")!)
    expect(container.querySelector("img")).toBeNull()
    const frame = container.querySelector("[data-grid-cover]")!
    expect(frame.className).toContain("aspect-[2/3]")
    expect(frame.contains(getByTestId("icon"))).toBe(true)
  })

  it("an empty src counts as no cover", () => {
    const [src] = createSignal("")
    const { container } = render(() => (
      <GridCover src={src()} fallback={icon} />
    ))
    expect(container.querySelector("img")).toBeNull()
  })
})
