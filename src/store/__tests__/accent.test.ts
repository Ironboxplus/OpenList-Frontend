import { afterEach, describe, expect, it } from "vitest"
import * as accent from "../accent"

// The media colour is the kit's: --primary, --ring and its foreground, on the
// page. hope-ui's palette variables (--hope-colors-*) are not written any more.
const style = () => document.documentElement.getAttribute("style") ?? ""

afterEach(() => accent.clearAccentPalette())

describe("the media accent on the page", () => {
  it("writes the kit's variables and no hope palette", () => {
    accent.applyAccentPalette("#336699", false)
    expect(style()).toContain("--primary: #336699")
    expect(style()).toContain("--ring: #336699")
    expect(style()).toContain("--primary-foreground")
    expect(style()).not.toContain("--hope")
    expect(document.body.getAttribute("style") ?? "").not.toContain("--hope")
  })

  it("takes them off again", () => {
    accent.applyAccentPalette("#336699", true)
    accent.clearAccentPalette()
    expect(style()).not.toContain("--primary")
    expect(style()).not.toContain("--ring")
  })

  it("has no palette builder for hope's twelve steps", () => {
    expect(Object.keys(accent)).not.toContain("accentPaletteStyleVars")
  })
})
