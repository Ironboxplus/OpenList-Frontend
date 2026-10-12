import { createEffect, onCleanup, type Accessor } from "solid-js"
import type { TransfersStore } from "../transfers/store"

/**
 * Run the transfers store for as long as the same user is signed in. `userId`
 * must change only when who is signed in changes (not whenever `me()` is
 * refetched with the same content), because leaving the effect resets the
 * store: task lists, the stall tracker and the finished local uploads.
 */
export const bindTransfersToUser = (
  userId: Accessor<number | undefined>,
  store: Pick<TransfersStore, "start" | "reset">,
) =>
  createEffect(() => {
    if (userId() === undefined) return
    const stop = store.start()
    onCleanup(() => {
      stop()
      store.reset()
    })
  })
