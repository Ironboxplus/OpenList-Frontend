import { createRoot, createSignal } from "solid-js"

// Play the next video of the folder when one ends: on unless turned off, the
// switch the player page had (localStorage "video_auto_next"), now in the
// viewer's More menu.
const KEY = "video_auto_next"

const [autoNext, setAutoNextSignal] = createRoot(() =>
  createSignal(localStorage.getItem(KEY) !== "false"),
)

export { autoNext }
export const setAutoNext = (on: boolean) => {
  localStorage.setItem(KEY, String(on))
  setAutoNextSignal(on)
}
