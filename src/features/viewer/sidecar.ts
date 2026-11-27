import { createEffect, createSignal, on, type Accessor } from "solid-js"
import { fetchSidecarSubtitles } from "~/utils/mpv-copy"

/**
 * The first sidecar subtitle of the video at `path`, for the external players
 * that take one (mpv's subfile). The backend does the matching, for storage
 * and share paths alike. A plain signal filled by an effect: a resource read
 * in the menu would suspend what renders it until the request returns. Until
 * it returns, and when it fails, the links carry no subtitle; an answer for a
 * video that is no longer the one shown is dropped.
 */
export const useSidecarSubtitle = (
  path: Accessor<string | undefined>,
  password: Accessor<string>,
) => {
  const [url, setUrl] = createSignal<string>()
  createEffect(
    on(path, async (p) => {
      setUrl(undefined)
      if (!p) return
      let found: string | undefined
      try {
        found = (await fetchSidecarSubtitles(p, password()))[0]
      } catch {
        found = undefined
      }
      if (path() === p) setUrl(found)
    }),
  )
  return url
}
