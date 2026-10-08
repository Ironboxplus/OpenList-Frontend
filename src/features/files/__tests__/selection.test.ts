import { describe, expect, it } from "vitest"
import {
  enterSelection,
  exitSelection,
  initialSelection,
  isAllSelected,
  rangeIndices,
  selectAllItems,
  selectRange,
  toggleItem,
} from "../selection"

describe("selection state machine", () => {
  it("long press enters the mode with that item", () => {
    const s = enterSelection(5)
    expect(s.active).toBe(true)
    expect([...s.selected]).toEqual([5])
    expect(s.anchor).toBe(5)
  })

  it("tapping toggles items; emptying the selection leaves the mode", () => {
    let s = enterSelection(1)
    s = toggleItem(s, 2)
    expect([...s.selected].sort()).toEqual([1, 2])
    s = toggleItem(s, 1)
    s = toggleItem(s, 2)
    expect(s.active).toBe(false)
    expect(s.selected.size).toBe(0)
  })

  it("exit clears everything", () => {
    expect(exitSelection()).toEqual(initialSelection)
  })

  it("select all covers items that are not rendered", () => {
    const s = selectAllItems(initialSelection, 3000)
    expect(s.selected.size).toBe(3000)
    expect(s.selected.has(2999)).toBe(true)
    expect(isAllSelected(s, 3000)).toBe(true)
    expect(isAllSelected(toggleItem(s, 10), 3000)).toBe(false)
  })

  it("select all of nothing is not a mode", () => {
    expect(selectAllItems(initialSelection, 0).active).toBe(false)
  })

  it("a range spans the viewport: 10..2500 selects every index in between", () => {
    let s = enterSelection(10)
    s = selectRange(s, 2500, 3000)
    expect(s.selected.size).toBe(2491)
    expect(s.selected.has(1500)).toBe(true)
    expect(s.selected.has(9)).toBe(false)
  })

  it("a range works upwards and keeps earlier selections", () => {
    let s = toggleItem(enterSelection(100), 50) // anchor is now 50
    s = selectRange(s, 40, 200)
    expect([...s.selected].sort((a, b) => a - b)).toEqual([
      40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 100,
    ])
  })

  it("rangeIndices clamps and handles empty lists", () => {
    expect(rangeIndices(3, 1, 10)).toEqual([1, 2, 3])
    expect(rangeIndices(-5, 2, 10)).toEqual([0, 1, 2])
    expect(rangeIndices(8, 99, 10)).toEqual([8, 9])
    expect(rangeIndices(0, 0, 0)).toEqual([])
  })
})
