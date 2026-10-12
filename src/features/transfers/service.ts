// The app-wide transfers store instance, wired to the real HTTP API.
import type { UnifiedTask } from "~/platform/contracts/task"
import { me } from "~/store/user"
import { UserMethods } from "~/types"
import { bus } from "~/utils/bus"
import { pointAtTasks } from "../shell/task-center"
import { notify } from "~/utils/notify"
import * as api from "./api"
import { localUploads } from "./local-uploads"
import { recordError } from "../notifications/service"
import { createdTaskIds, taskFailureInput, type TacheType } from "./adapter"
import { createTransfersStore } from "./store"

const succeededListeners = new Set<(task: UnifiedTask) => void>()

/** Subscribe to "a task just finished successfully"; returns an unsubscribe. */
export const onTaskSucceeded = (cb: (task: UnifiedTask) => void) => {
  succeededListeners.add(cb)
  return () => void succeededListeners.delete(cb)
}

export const transfers = createTransfersStore({
  onSucceeded: (task) => succeededListeners.forEach((cb) => cb(task)),
  onFailed: (task) => recordError(taskFailureInput(task)),
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

bus.on("tasks:created", (ids) => {
  void transfers.refresh({ full: true })
  pointAtTasks(ids)
})

/**
 * The one way an action reports the tasks it started: with their ids when the
 * response carries them, otherwise as a plain refresh request.
 */
export const announceTasks = (type: TacheType, responseData: unknown) => {
  const ids = createdTaskIds(type, responseData)
  if (ids.length > 0) bus.emit("tasks:created", ids)
  else bus.emit("tasks:refresh")
}
