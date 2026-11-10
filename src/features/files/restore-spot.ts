// The files section remembers its last folder and scroll (shell/files-memory),
// so that Files, pressed from another section, comes back to where it was.
import { createEffect, on, onCleanup, onMount, untrack } from "solid-js"
import { useRouter } from "~/hooks"
import { objStore, State } from "~/store"
import {
  currentSpot,
  forgetSpot,
  rememberFolder,
  rememberScroll,
  takeRestoreIntent,
} from "../shell/files-memory"

/** Give up on a restore that the page cannot satisfy (empty or failing folder). */
const RESTORE_TIMEOUT = 10_000
/** Frames the scroll has to hold still, since a virtual list settles over a few. */
const STABLE_FRAMES = 5
/** What the user does to take the scroll back. */
const INTERRUPTS = ["wheel", "touchstart", "keydown", "pointerdown"] as const

export const useRestoreSpot = () => {
  const { pathname, to } = useRouter()
  // True while a restore owns the scroll position: its own moves are not the user's.
  let restoring = false

  createEffect(
    on(
      () => objStore.state,
      (state) => {
        if (state === State.Folder) rememberFolder(untrack(pathname))
      },
    ),
  )

  let frame = 0
  const onScroll = () => {
    if (restoring || frame) return
    frame = requestAnimationFrame(() => {
      frame = 0
      if (objStore.state === State.Folder) {
        rememberScroll(pathname(), window.scrollY)
      }
    })
  }
  window.addEventListener("scroll", onScroll, { passive: true })
  onCleanup(() => {
    window.removeEventListener("scroll", onScroll)
    cancelAnimationFrame(frame)
  })

  onMount(() => {
    const spot = currentSpot()
    const explicit = takeRestoreIntent()
    if (!spot || spot.path !== pathname()) return
    const started = performance.now()
    let stable = 0
    let raf = 0
    restoring = true
    const stop = () => {
      restoring = false
      cancelAnimationFrame(raf)
      for (const e of INTERRUPTS) window.removeEventListener(e, stop)
    }
    for (const e of INTERRUPTS) {
      window.addEventListener(e, stop, { passive: true })
    }
    onCleanup(stop)
    const tick = () => {
      const failed = !!objStore.err || objStore.state === State.NeedPassword
      if (failed && explicit) {
        // The remembered folder is gone or not allowed: start from the root.
        forgetSpot()
        stop()
        to("/", false, { replace: true })
        return
      }
      if (
        failed ||
        // a folder that cannot get that long (or not at all)
        performance.now() - started > RESTORE_TIMEOUT
      ) {
        return stop()
      }
      if (objStore.state === State.Folder) {
        window.scrollTo(0, spot.scroll)
        stable = Math.abs(window.scrollY - spot.scroll) < 2 ? stable + 1 : 0
        if (stable >= STABLE_FRAMES) return stop()
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
  })
}
