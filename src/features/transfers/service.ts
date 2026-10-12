// The app-wide transfers store instance, wired to the real HTTP API.
import type { UnifiedTask } from "~/platform/contracts/task"
import { me } from "~/store/user"
import { UserMethods } from "~/types"
import { bus } from "~/utils/bus"
import { notify } from "~/utils/notify"
import * as api from "./api"
import { localUploads } from "./local-uploads"
import { createTransfersStore } from "./store"

const succeededListeners = new Set<(task: UnifiedTask) => void>()

/** Subscribe to "a task just finished successfully"; returns an unsubscribe. */
export const onTaskSucceeded = (cb: (task: UnifiedTask) => void) => {
  succeededListeners.add(cb)
  return () => void succeededListeners.delete(cb)
}

export const transfers = createTransfersStore({
  onSucceeded: (task) => succeededListeners.forEach((cb) => cb(task)),
  fetchTache: api.fetchTache,
  postTache: api.postTache,
  fetchSyncList: api.fetchSyncList,
  fetchSyncHistory: () => api.fetchSyncHistory(50),
  fetchSyncJob: (id) => api.fetchSyncJob(id, true),
  cancelSync: api.cancelSync,
  isAdmin: () => UserMethods.is_admin(me()),
  isHidden: () => document.hidden,
  localUploads,
  notifyError: (msg) => notify.error(msg),
  info: (msg) => console.info(msg),
  now: () => new Date(),
  storage: localStorage,
})

// Home emits this after it creates a task (copy, move, offline download,
// decompress, upload as task) so the new task shows up without waiting.
bus.on("tasks:refresh", () => {
  void transfers.refresh({ full: false })
})
