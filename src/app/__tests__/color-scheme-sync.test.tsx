import { HopeProvider } from "@hope-ui/solid"
import { render } from "@solidjs/testing-library"
import { describe, expect, it } from "vitest"
import { colorMode, setColorMode, toggleColorMode } from "~/store/color-mode"
import { ColorSchemeSync } from "../ColorSchemeSync"

// The store is the one colour mode: the page's dark class and colour scheme
// follow it, and so do hope's components while they last (P5 B1 to B6).
describe("ColorSchemeSync", () => {
  it("puts the store's mode on the page and on hope's provider", () => {
    setColorMode("light")
    render(() => (
      <HopeProvider>
        <ColorSchemeSync />
      </HopeProvider>
    ))
    const html = document.documentElement
    expect(html.classList.contains("dark")).toBe(false)
    expect(document.body.classList.contains("hope-ui-light")).toBe(true)
    toggleColorMode()
    expect(colorMode()).toBe("dark")
    expect(html.classList.contains("dark")).toBe(true)
    expect(html.style.colorScheme).toBe("dark")
    expect(document.body.classList.contains("hope-ui-dark")).toBe(true)
  })
})
