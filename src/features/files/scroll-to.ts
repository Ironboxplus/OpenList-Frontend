// Scrolling to an item by index, for both plain and virtualized lists. A
// virtualized list registers itself here while mounted; a plain list has every
// row in the DOM so the browser can do it.

let virtualScroller: ((index: number) => void) | undefined

export const setVirtualScroller = (
  fn: ((index: number) => void) | undefined,
) => {
  virtualScroller = fn
}

const rowAt = (index: number) =>
  document.querySelector<HTMLElement>(`.viselect-item[data-index="${index}"]`)

export const scrollToIndex = (index: number) => {
  if (virtualScroller) virtualScroller(index)
  else rowAt(index)?.scrollIntoView?.({ block: "center" })
}

/**
 * Bring the entry called `name` into view and flash it (CSS animation, about
 * two seconds). Returns false when the directory has no such entry.
 */
export const revealByName = async (
  names: readonly string[],
  name: string,
): Promise<boolean> => {
  const index = names.indexOf(name)
  if (index < 0) return false
  // The list may still be mounting (its virtualizer registers late), so keep
  // asking for the scroll until the row exists.
  let el: HTMLElement | undefined
  for (let i = 0; i < 600 && !el; i++) {
    scrollToIndex(index)
    await new Promise((r) => requestAnimationFrame(r))
    const row = rowAt(index)
    const r = row?.getBoundingClientRect()
    // Mounted is not enough: an early scroll request can be clamped to the top
    // while the list is still sizing itself, so wait until the row is on screen.
    if (row && r && r.bottom > 0 && r.top < window.innerHeight) el = row
  }
  if (!el) return false
  el.removeAttribute("data-highlight")
  // Restart the animation if the same row is revealed twice in a row.
  void el.offsetWidth
  el.setAttribute("data-highlight", "")
  el.addEventListener(
    "animationend",
    () => el.removeAttribute("data-highlight"),
    { once: true },
  )
  return true
}
