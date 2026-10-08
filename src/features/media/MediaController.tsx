import { createEffect, on, onCleanup } from "solid-js"
import { useRouter } from "~/hooks"
import { objStore, State } from "~/store"
import { mediaClient } from "./client"
import { MediaHeader } from "./MediaHeader"
import { mediaTick, setMediaFor, setMediaInvalidator } from "./state"

/**
 * Lazily loaded host of the media view: asks the backend once per directory
 * visit, publishes the answer into the small shared state, and renders the
 * header card and the editor. A backend without the API (404) or with media
 * switched off leaves the Files page exactly as it was.
 */
const MediaController = () => {
  const { pathname } = useRouter()

  setMediaInvalidator((path) => mediaClient.invalidate(path))
  onCleanup(() => setMediaInvalidator(undefined))

  // Drop the previous directory's data the moment the path changes, so a
  // header or poster wall never shows up under the wrong folder.
  createEffect(on(pathname, () => setMediaFor("", undefined), { defer: true }))

  createEffect(() => {
    const path = pathname()
    mediaTick()
    const ready =
      objStore.state === State.Folder || objStore.state === State.FetchingMore
    if (!ready || mediaClient.isUnavailable()) return
    void mediaClient.get(path).then((fs) => {
      // The user may have moved on while the request was in flight.
      if (fs && pathname() === path) setMediaFor(path, fs)
    })
  })

  return (
    <>
      <MediaHeader />
    </>
  )
}

export default MediaController
