import { describe, expect, it } from "vitest"
import {
  gridColumns,
  gridRowOf,
  gridRowRange,
  rowEstimate,
  shouldVirtualize,
  VIRTUALIZE_ABOVE,
} from "../virtualize"

describe("shouldVirtualize", () => {
  it("only the all-items pager with more than 200 items", () => {
    expect(shouldVirtualize("all", VIRTUALIZE_ABOVE + 1)).toBe(true)
    expect(shouldVirtualize("all", VIRTUALIZE_ABOVE)).toBe(false)
    expect(shouldVirtualize("all", 0)).toBe(false)
  })
  it.each(["pagination", "load_more", "auto_load_more"] as const)(
    "never in %s mode",
    (m) => expect(shouldVirtualize(m, 5000)).toBe(false),
  )
})

describe("gridColumns", () => {
  it("is fixed on phone and tablet", () => {
    expect(gridColumns(390, "phone")).toBe(2)
    expect(gridColumns(900, "tablet")).toBe(4)
  })
  it("fills desktop width with 160px columns, at least four", () => {
    expect(gridColumns(1172, "desktop")).toBe(7)
    expect(gridColumns(1320, "desktop")).toBe(7)
    expect(gridColumns(500, "desktop")).toBe(4)
  })
})

describe("grid rows", () => {
  it("maps items to rows and back", () => {
    expect(gridRowOf(0, 4)).toBe(0)
    expect(gridRowOf(7, 4)).toBe(1)
    expect(gridRowRange(1, 4, 10)).toEqual([4, 8])
    expect(gridRowRange(2, 4, 10)).toEqual([8, 10])
  })
})

describe("rowEstimate", () => {
  it("44 on desktop, 60 on phone, taller for media rows", () => {
    expect(rowEstimate(false, false)).toBe(44)
    expect(rowEstimate(true, false)).toBe(60)
    expect(rowEstimate(false, true)).toBeGreaterThan(60)
  })
})
