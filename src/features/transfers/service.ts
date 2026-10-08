// The app-wide transfers store instance, wired to the real HTTP API.
import { me } from "~/store/user"
import { UserMethods } from "~/types"
import { bus } from "~/utils/bus"
import { notify } from "~/utils/notify"
import * as api from "./api"
import { createTransfersStore } from "./store"

export const transfers = createTransfersStore({
  fetchTache: api.fetchTache,
  postTache: api.postTache,
  fetchSyncList: api.fetchSyncList,
  fetchSyncHistory: () => api.fetchSyncHistory(50),
  fetchSyncJob: (id) => api.fetchSyncJob(id, true),
  cancelSync: api.cancelSync,
  isAdmin: () => UserMethods.is_admin(me()),
  isHidden: () => document.hidden,
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
