import mitt from "mitt"
import { SeedInfo, TorrentInfo } from "~/types"

type Events = {
  to: string
  gallery: string
  tool: string
  /** Open the folder search dialog and search for this text. */
  search: string
  pathname: string
  extract: string
  "tasks:refresh": void
  /** Ids (UnifiedTask.id) of tasks an action just created. */
  "tasks:created": string[]
  /**
   * The listing is about to change in place: another layout of the folder, or
   * its rows (a new listing of the same folder, a new order). Sent before the
   * change, so the file browser can take a picture of what is there.
   */
  "files:before": "layout" | "rows"
  torrent_parsed: { torrentData: string; info: TorrentInfo }
  seed_parsed: { seedData: string; fileName: string; info: SeedInfo }
  generate_transfer_seed: { paths: string[] }
  "plugin:file_action_registered": any
  "plugin:header_action_registered": any
}

export const bus = mitt<Events>()
