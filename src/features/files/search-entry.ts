import { getSetting, objStore, State } from "~/store"
import { bus } from "~/utils/bus"

/** Whether the current folder can be searched (a listing, index enabled). */
export const fileSearchAvailable = (): boolean =>
  objStore.state === State.Folder && getSetting("search_index") !== "none"

/** Open the folder search dialog, optionally already searching for `query`. */
export const openFileSearch = (query?: string): void => {
  if (query) bus.emit("search", query)
  else bus.emit("tool", "search")
}
