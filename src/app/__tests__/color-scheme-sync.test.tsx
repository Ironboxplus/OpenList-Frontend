import { render } from "@solidjs/testing-library"
import { describe, expect, it } from "vitest"
import { colorMode, setColorMode, toggleColorMode } from "~/store/color-mode"
import { ColorSchemeSync } from "../ColorSchemeSync"

// The store is the one colour mode: the page's dark class and colour scheme
// follow it, and nothing else holds a copy.
describe("ColorSchemeSync", () => {
  it("puts the store's mode on the page", () => {
    setColorMode("light")
    render(() => <ColorSchemeSync />)
    const html = document.documentElement
    expect(html.classList.contains("dark")).toBe(false)
    expect(html.style.colorScheme).toBe("light")
    toggleColorMode()
    expect(colorMode()).toBe("dark")
    expect(html.classList.contains("dark")).toBe(true)
    expect(html.style.colorScheme).toBe("dark")
    expect(document.body.className).not.toMatch(/hope/)
  })
})
