import {
  Badge,
  Box,
  HStack,
  Progress,
  ProgressIndicator,
  Text,
} from "@hope-ui/solid"
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
      console.warn(`storage loading poll failed (${health().failures} in a row)`)
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
      <Box
        w="$full"
        px="$2"
        pt="$2"
        opacity={health().stale ? 0.6 : 1}
        aria-busy={!health().stale}
      >
        <HStack justifyContent="space-between" mb="$1">
          <Text fontSize="$sm" color="$neutral11">
            {t("storages.loading.title")}
          </Text>
          <HStack spacing="$2">
            <Show when={health().stale}>
              <Badge colorScheme="warning" data-testid="loading-stale">
                {t("errors.status_stale")}
              </Badge>
            </Show>
            <Text fontSize="$sm" color="$neutral10">
              {summary()!.settled}/{summary()!.total}
            </Text>
            <Show when={summary()!.hasFailures}>
              <Badge colorScheme="danger">
                {summary()!.failed} {t("storages.loading.failed")}
              </Badge>
            </Show>
          </HStack>
        </HStack>
        <Progress
          size="sm"
          value={summary()!.percent}
          trackColor="$neutral4"
          rounded="$full"
        >
          <ProgressIndicator
            rounded="$full"
            color={summary()!.hasFailures ? "$warning9" : "$accent9"}
          />
        </Progress>
      </Box>
    </Show>
  )
}

export default StorageLoadingBar
