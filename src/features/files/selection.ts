// Selection state machine shared by the phone long-press mode, the desktop
// action bar and shift-range selection. It works on indices into the full item
// list, never on rendered rows, so virtualized (unrendered) items are
// selected, ranged and counted like any other.

export interface SelectionState {
  /** Phone selection mode: entered by long press, left by cancel / empty. */
  active: boolean
  selected: ReadonlySet<number>
  /** Last item acted on; the start of a shift range. */
  anchor?: number
}

export const initialSelection: SelectionState = {
  active: false,
  selected: new Set(),
}

const withSet = (
  s: SelectionState,
  selected: Set<number>,
  anchor = s.anchor,
) => ({
  ...s,
  selected,
  anchor,
})

/** Long press: enter the mode with that item selected. */
export const enterSelection = (index: number): SelectionState => ({
  active: true,
  selected: new Set([index]),
  anchor: index,
})

export const exitSelection = (): SelectionState => initialSelection

/** Tap in selection mode. Deselecting the last item leaves the mode. */
export const toggleItem = (
  s: SelectionState,
  index: number,
): SelectionState => {
  const next = new Set(s.selected)
  if (next.has(index)) next.delete(index)
  else next.add(index)
  if (next.size === 0) return exitSelection()
  return withSet({ ...s, active: true }, next, index)
}

export const selectAllItems = (
  s: SelectionState,
  total: number,
): SelectionState => ({
  ...s,
  active: total > 0,
  selected: new Set(Array.from({ length: total }, (_, i) => i)),
})

/** Inclusive index range between two items, in either direction. */
export const rangeIndices = (
  from: number,
  to: number,
  total: number,
): number[] => {
  if (total <= 0) return []
  const lo = Math.max(0, Math.min(from, to))
  const hi = Math.min(total - 1, Math.max(from, to))
  return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)
}

/** Shift-click: everything between the anchor and `index` joins the selection. */
export const selectRange = (
  s: SelectionState,
  index: number,
  total: number,
): SelectionState => {
  const anchor = s.anchor ?? index
  const next = new Set(s.selected)
  for (const i of rangeIndices(anchor, index, total)) next.add(i)
  return withSet({ ...s, active: true }, next, anchor)
}

export const isAllSelected = (s: SelectionState, total: number): boolean =>
  total > 0 && s.selected.size === total
