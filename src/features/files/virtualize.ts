// Decisions about long lists. Pure so the thresholds are testable.

export type PagerType = "all" | "pagination" | "load_more" | "auto_load_more"

/** Above this many items, the "all" pager mode renders only what is visible. */
export const VIRTUALIZE_ABOVE = 200

/**
 * The other pager modes already cap how much is on screen; only "all" can put
 * thousands of rows in the DOM.
 */
export const shouldVirtualize = (pager: PagerType, count: number): boolean =>
  pager === "all" && count > VIRTUALIZE_ABOVE

/** Estimated row heights (px); real heights are measured after render. */
export const ROW_HEIGHT = { desktop: 44, phone: 60 } as const

export const rowEstimate = (phone: boolean, media: boolean): number =>
  media ? 76 : phone ? ROW_HEIGHT.phone : ROW_HEIGHT.desktop

/**
 * Grid columns for a container width: phones 2, tablets 4, desktops as many
 * `minWidth` columns as fit (never fewer than 4 once it is wide enough).
 */
export const gridColumns = (
  width: number,
  viewport: "phone" | "tablet" | "desktop",
  minWidth = 160,
  gap = 8,
): number => {
  if (viewport === "phone") return 2
  if (viewport === "tablet") return 4
  return Math.max(4, Math.floor((width + gap) / (minWidth + gap)))
}

/** Index of the grid row holding item `index`. */
export const gridRowOf = (index: number, columns: number): number =>
  Math.floor(index / Math.max(1, columns))

/** Items of one grid row. */
export const gridRowRange = (
  row: number,
  columns: number,
  total: number,
): [number, number] => {
  const start = row * columns
  return [start, Math.min(total, start + columns)]
}

/**
 * Columns of the folder/file cards: phones 2, everything else as many
 * `minWidth` cards as fit (the plain grid's `auto-fill, minmax(minWidth, 1fr)`).
 */
export const cardColumns = (
  width: number,
  viewport: "phone" | "tablet" | "desktop",
  minWidth = 240,
  gap = 16,
): number =>
  viewport === "phone"
    ? 2
    : Math.max(1, Math.floor((width + gap) / (minWidth + gap)))

export type CardRow =
  { kind: "title"; text: string } | { kind: "cards"; items: number[] }

/**
 * The card grid as virtual rows: a title row, then the cards `columns` to a
 * row, for the folders and then for the files; an empty section has no title.
 */
export const sectionRows = (
  sections: { title: string; items: number[] }[],
  columns: number,
): CardRow[] => {
  const rows: CardRow[] = []
  for (const { title, items } of sections) {
    if (items.length === 0) continue
    rows.push({ kind: "title", text: title })
    for (let i = 0; i < items.length; i += columns)
      rows.push({ kind: "cards", items: items.slice(i, i + columns) })
  }
  return rows
}

/** The row holding the card of store index `item`, if it is in any. */
export const rowOfItem = (
  rows: CardRow[],
  item: number,
): number | undefined => {
  const row = rows.findIndex(
    (r) => r.kind === "cards" && r.items.includes(item),
  )
  return row < 0 ? undefined : row
}
