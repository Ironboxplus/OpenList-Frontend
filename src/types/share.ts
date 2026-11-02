import { ExtractFolder, OrderBy, OrderDirection } from "~/types/storage"

export interface Share {
  id?: string
  expires: string | null
  pwd: string
  max_accessed: number
  burn_after_read: boolean
  allow_preview: boolean
  allow_download: boolean
  disabled: boolean
  order_by: OrderBy
  order_direction: OrderDirection
  extract_folder: ExtractFolder
  files: string[]
  remark: string
  readme: string
  header: string
}

export interface ShareUpdate extends Share {
  id: string
  new_id: string
  accessed: number
}

export interface ShareInfo extends ShareUpdate {
  has_password: boolean
  view_count: number
  download_count: number
  last_access_at: string | null
  /** When the access limit was first reached; null while the share is open. */
  consumed_at: string | null
  creator: string
  creator_role: number
}
