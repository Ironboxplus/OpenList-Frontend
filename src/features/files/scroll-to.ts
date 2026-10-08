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

/** Row element for `index`, waiting a few frames for a virtualized row to mount. */
export const whenRowMounted = (
  index: number,
  frames = 30,
): Promise<HTMLElement | undefined> =>
  new Promise((resolve) => {
    const tick = (left: number) => {
      const el = rowAt(index)
      if (el || left <= 0) return resolve(el ?? undefined)
      requestAnimationFrame(() => tick(left - 1))
    }
    tick(frames)
  })

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
  scrollToIndex(index)
  const el = await whenRowMounted(index)
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
