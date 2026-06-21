import { describe, it, expect } from "vitest"
import { shouldShowPreview } from "../preview"

describe("shouldShowPreview", () => {
  it("returns true when enabled, not touch, and thumb is non-empty", () => {
    expect(
      shouldShowPreview({
        thumb: "https://cdn/thumb.jpg",
        isTouch: false,
        enabled: true,
      }),
    ).toBe(true)
  })

  it("returns false when plugin is disabled, even with thumb and no touch", () => {
    expect(
      shouldShowPreview({
        thumb: "https://cdn/thumb.jpg",
        isTouch: false,
        enabled: false,
      }),
    ).toBe(false)
  })

  it("returns false on touch devices, even when enabled and thumb present", () => {
    expect(
      shouldShowPreview({
        thumb: "https://cdn/thumb.jpg",
        isTouch: true,
        enabled: true,
      }),
    ).toBe(false)
  })

  it("returns false when thumb is an empty string", () => {
    expect(
      shouldShowPreview({ thumb: "", isTouch: false, enabled: true }),
    ).toBe(false)
  })

  it("returns false when both touch and disabled", () => {
    expect(
      shouldShowPreview({
        thumb: "https://cdn/thumb.jpg",
        isTouch: true,
        enabled: false,
      }),
    ).toBe(false)
  })
})
