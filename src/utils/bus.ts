import mitt from "mitt"
import { TorrentInfo } from "~/types"

type Events = {
  to: string
  gallery: string
  tool: string
  pathname: string
  extract: string
  "tasks:refresh": void
  /** Ids (UnifiedTask.id) of tasks an action just created. */
  "tasks:created": string[]
  torrent_parsed: { torrentData: string; info: TorrentInfo }
  "plugin:file_action_registered": any
  "plugin:header_action_registered": any
}

export const bus = mitt<Events>()
