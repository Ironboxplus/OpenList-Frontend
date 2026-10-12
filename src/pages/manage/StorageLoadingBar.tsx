import { Badge } from "~/components/ui/badge"
import { Progress } from "~/components/ui/progress"
import { Show, createMemo, createSignal, onCleanup, onMount } from "solid-js"
import { useT } from "~/hooks"
import {
  handleRespWithoutNotify,
  loadingSummary,
  r,
  type LoadingSnapshot,
} from "~/utils"
import { healthy, pollFailed, pollSucceeded } from "./poll-health"
import type { Resp } from "~/types"
import { cn } from "~/utils/cn"

const POLL_INTERVAL = 1500

/**
 * A thin, self-dismissing status bar that polls the backend storage loading
 * progress (/admin/storage/loading) and shows how many drivers have finished
 * initialising. It renders nothing once loading is complete, so an already-warm
 * instance shows no flicker. Admin-only endpoint, so mount it in the manage area.
 */
export const StorageLoadingBar = () => {
  const t = useT()
  const [snap, setSnap] = createSignal<LoadingSnapshot>()
  const [health, setHealth] = createSignal(healthy)
  let timer: number | undefined
  let stopped = false

  const poll = async () => {
    // Failures stay quiet (no toast): count them, and after a few in a row the
    // bar says its numbers are stale instead of pretending they are live.
    let failed = false
    try {
      const resp: Resp<LoadingSnapshot> = await r.get("/admin/storage/loading")
      handleRespWithoutNotify(
        resp,
        (data) => setSnap(data),
        () => {
          failed = true
        },
      )
    } catch (e) {
      failed = true
      console.warn("storage loading poll failed", e)
    }
    if (failed) {
      setHealth(pollFailed(health()))
      console.warn(
        `storage loading poll failed (${health().failures} in a row)`,
      )
    } else {
      setHealth(pollSucceeded())
    }
    const s = snap()
    if (stopped || (s && loadingSummary(s).done)) return
    timer = window.setTimeout(poll, POLL_INTERVAL)
  }

  onMount(poll)
  onCleanup(() => {
    stopped = true
    if (timer) clearTimeout(timer)
  })

  const summary = createMemo(() => {
    const s = snap()
    return s ? loadingSummary(s) : undefined
  })

  return (
    <Show when={summary() && !summary()!.done}>
      <div
        class={cn("w-full px-2 pb-2", health().stale && "opacity-60")}
        aria-busy={!health().stale}
      >
        <div class="mb-1 flex items-center justify-between gap-2 text-sm">
          <span class="text-muted-foreground">
            {t("storages.loading.title")}
          </span>
          <div class="flex items-center gap-2">
            <Show when={health().stale}>
              <Badge variant="warning" data-testid="loading-stale">
                {t("errors.status_stale")}
              </Badge>
            </Show>
            <span class="text-muted-foreground">
              {summary()!.settled}/{summary()!.total}
            </span>
            <Show when={summary()!.hasFailures}>
              <Badge variant="destructive">
                {summary()!.failed} {t("storages.loading.failed")}
              </Badge>
            </Show>
          </div>
        </div>
        <Progress
          value={summary()!.percent}
          class="gap-0"
          fillClass={summary()!.hasFailures ? "bg-warning" : undefined}
        />
      </div>
    </Show>
  )
}

export default StorageLoadingBar
