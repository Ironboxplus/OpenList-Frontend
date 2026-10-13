export interface PollOptions {
  intervalMs: number
  /** One round of work. The next round is scheduled after it settles. */
  tick: () => Promise<unknown>
  isHidden?: () => boolean
}

/**
 * Polls `tick` every `intervalMs` while the page is visible: it pauses when the
 * tab is hidden and refreshes at once when the tab comes back. Rounds never
 * overlap (`refresh` during a round is folded into it). A tick that throws is
 * swallowed; it is the tick's business to report failures.
 */
export const createPoller = (opts: PollOptions) => {
  const hidden = opts.isHidden ?? (() => document.hidden)
  let timer: ReturnType<typeof setTimeout> | undefined
  let started = false
  let inflight: Promise<void> | undefined

  const clear = () => {
    if (timer !== undefined) clearTimeout(timer)
    timer = undefined
  }
  const schedule = () => {
    clear()
    if (!started || hidden()) return
    timer = setTimeout(() => void refresh(), opts.intervalMs)
  }
  const refresh = (): Promise<void> => {
    clear()
    if (inflight) return inflight
    inflight = Promise.resolve()
      .then(opts.tick)
      .then(
        () => {},
        () => {},
      )
      .finally(() => {
        inflight = undefined
        schedule()
      })
    return inflight
  }
  const onVisibility = () => {
    if (!started) return
    if (hidden()) clear()
    else void refresh()
  }

  return {
    refresh,
    start: () => {
      if (started) return
      started = true
      document.addEventListener("visibilitychange", onVisibility)
      if (!hidden()) void refresh()
    },
    stop: () => {
      started = false
      clear()
      document.removeEventListener("visibilitychange", onVisibility)
    },
  }
}
