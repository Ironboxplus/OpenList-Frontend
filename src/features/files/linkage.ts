// Files page <-> Transfers (REFACTOR_PLAN 7.7): refresh the open folder when a
// task that writes into it finishes, and scroll to / flash the file named by
// ?highlight= when the Transfers page sends the user here.
import { createEffect, onCleanup, untrack } from "solid-js"
import { usePath, useRouter } from "~/hooks"
import { objStore, State } from "~/store"
import { onTaskSucceeded } from "../transfers/service"
import { invalidateMedia } from "../media/state"
import { revealByName } from "./scroll-to"
import { norm, treePath } from "./tasks-for-path"

const first = (v: string | string[] | undefined) =>
  Array.isArray(v) ? v[0] : v

export const useFilesLinkage = () => {
  const { pathname, searchParams, setSearchParams } = useRouter()
  const { refresh } = usePath()

  // Once per finished task (the store reports each only once): when it wrote
  // into the folder on screen, reload that folder. Reuses the page's own
  // refresh; no timer and no extra request beyond that reload.
  onCleanup(
    onTaskSucceeded((task) => {
      const dst = treePath(task.destination?.path)
      if (!dst || objStore.state !== State.Folder) return
      if (norm(dst) === norm(pathname())) {
        invalidateMedia(pathname())
        void refresh(undefined, true)
      }
    }),
  )

  createEffect(() => {
    const name = first(searchParams.highlight)
    if (!name || objStore.state !== State.Folder || objStore.objs.length === 0)
      return
    const names = untrack(() => objStore.objs.map((o) => o.name))
    // Wait a frame so the layout (and its saved sort order) has settled.
    requestAnimationFrame(() => {
      void revealByName(names, name).then(() =>
        setSearchParams({ highlight: undefined }, { replace: true }),
      )
    })
  })
}
