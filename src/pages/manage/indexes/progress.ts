import { createSignal, onCleanup } from "solid-js"
import { useFetch } from "~/hooks"
import { PResp } from "~/types"
import { handleResp, r } from "~/utils"

const POLL_MS = 5000

/**
 * Progress of a long backend job (index build, manual scan): fetch now, and
 * keep fetching every few seconds until it reports done. `retryOnError` says
 * whether a failed fetch (by status code) is worth another try.
 */
export const createProgressPoll = <T extends { is_done: boolean }>(
  url: string,
  retryOnError: (code: number) => boolean = () => true,
) => {
  const [progress, setProgress] = createSignal<T>()
  const [loading, fetchProgress] = useFetch((): PResp<T> => r.get(url))
  let timer: number | undefined
  const schedule = (again: boolean) => {
    window.clearTimeout(timer)
    timer = again ? window.setTimeout(refresh, POLL_MS) : undefined
  }
  const refresh = async () => {
    handleResp(
      await fetchProgress(),
      (data) => {
        setProgress(() => data)
        schedule(!data.is_done)
      },
      (_, code) => schedule(retryOnError(code)),
    )
  }
  onCleanup(() => window.clearTimeout(timer))
  refresh()
  return { progress, loading, refresh }
}
