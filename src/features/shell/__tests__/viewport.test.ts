import { describe, expect, it } from "vitest"
import { viewportFor } from "../viewport"

describe("viewportFor", () => {
  it.each([
    [390, "phone"],
    [639, "phone"],
    [640, "tablet"],
    [820, "tablet"],
    [1023, "tablet"],
    [1024, "desktop"],
    [1440, "desktop"],
  ])("%ipx -> %s", (w, v) => {
    expect(viewportFor(w)).toBe(v)
  })
})
