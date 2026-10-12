import { createSignal } from "solid-js"

/** Whether the Task Center drawer is open; the TopBar button toggles it. */
export const [taskCenterOpen, setTaskCenterOpen] = createSignal(false)

/** How long the tasks an action just created stay highlighted in the drawer. */
export const HIGHLIGHT_MS = 3000

const [highlighted, setHighlighted] = createSignal<ReadonlySet<string>>(
  new Set<string>(),
)
/** Ids of the tasks the drawer is currently pointing at. */
export { highlighted }

/** Counts up whenever the TopBar badge should call attention to itself. */
export const [nudge, setNudge] = createSignal(0)

let generation = 0
let timer: ReturnType<typeof setTimeout> | undefined

/**
 * New tasks were created: highlight them when the drawer is open, otherwise
 * nudge the TopBar badge. Never opens the drawer.
 */
export const pointAtTasks = (ids: readonly string[]) => {
  if (ids.length === 0) return
  if (!taskCenterOpen()) {
    setNudge((n) => n + 1)
    return
  }
  const mine = ++generation
  clearTimeout(timer)
  setHighlighted(new Set<string>(ids))
  timer = setTimeout(() => {
    if (generation === mine) setHighlighted(new Set<string>())
  }, HIGHLIGHT_MS)
}

/** Test hook: forget highlights and pending timers. */
export const resetTaskCenterPointer = () => {
  generation++
  clearTimeout(timer)
  setHighlighted(new Set<string>())
  setNudge(0)
}
