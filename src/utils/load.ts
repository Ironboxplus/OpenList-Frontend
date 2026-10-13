import { type Accessor, createEffect, createSignal, on } from "solid-js"

/**
 * Data a view loads for itself, without ever suspending. `createResource`
 * registers every read of its value with the nearest Suspense boundary, and a
 * router transition then waits for it: a section switch would hold the old
 * page until the new page's data arrived. Here the page commits at once and the
 * reader shows its own placeholder while `loading()` is true.
 *
 * Runs once right away and again whenever `source` changes; a stale answer
 * (an older run finishing late) is dropped. A failure keeps the last good data.
 */
export const createLoad = <S, T>(
  source: Accessor<S>,
  fetcher: (source: S) => Promise<T>,
) => {
  const [data, setData] = createSignal<T>()
  const [error, setError] = createSignal<unknown>()
  const [loading, setLoading] = createSignal(true)
  let run = 0
  const load = async () => {
    const mine = ++run
    setLoading(true)
    try {
      const value = await fetcher(source())
      if (mine !== run) return
      setData(() => value)
      setError(undefined)
    } catch (e) {
      if (mine === run) setError(() => e)
    } finally {
      if (mine === run) setLoading(false)
    }
  }
  createEffect(on(source, () => void load()))
  return { data, error, loading, refetch: load }
}
