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
import { handleResp, loadingSummary, r, type LoadingSnapshot } from "~/utils"
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
  let timer: number | undefined
  let stopped = false

  const poll = async () => {
    try {
      const resp: Resp<LoadingSnapshot> = await r.get("/admin/storage/loading")
      handleResp(resp, (data) => setSnap(data))
    } catch {
      /* transient; try again on the next tick */
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
      <Box w="$full" px="$2" pt="$2">
        <HStack justifyContent="space-between" mb="$1">
          <Text fontSize="$sm" color="$neutral11">
            {t("storages.loading.title")}
          </Text>
          <HStack spacing="$2">
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
