import { PageResp } from "~/types/resp"

export enum ObjType {
  UNKNOWN,
  FOLDER,
  // OFFICE,
  VIDEO,
  AUDIO,
  TEXT,
  IMAGE,
}

/**
 * Optional driver-specific metadata (backend `extra`). All fields are optional
 * and the index signature keeps it forward-compatible: the UI reads the keys it
 * knows and ignores anything else, so a changed backend payload never breaks it.
 */
export interface ObjExtra {
  /** Media duration in seconds. */
  duration?: number
  /** Short video-resolution badge, e.g. "1080P" / "4K". */
  resolution?: string
  /** Whether the item is starred on the provider. */
  starred?: boolean
  /** Provider file tags. */
  tags?: string[]
  [key: string]: unknown
}

export interface Obj {
  name: string
  size: number
  is_dir: boolean
  created: string
  modified: string
  sign?: string
  thumb: string
  type: ObjType
  mount_details?: MountDetails
  extra?: ObjExtra
}

export type StoreObj = Obj & {
  selected?: boolean
}

export type ArchiveObj = Obj & {
  inner_path?: string
  archive?: Obj
  pass?: string
}

export type RenameObj = {
  src_name: string
  new_name: string
}

export type ObjTree = Obj & {
  children?: ObjTree[]
}

export type ArchiveMeta = {
  content: ObjTree[] | null
  encrypted: boolean
  comment: string
  sort?: {
    order_by: "" | "name" | "size" | "modified"
    order_direction: "" | "asc" | "desc"
    extract_folder: "" | "front" | "back"
  }
  raw_url: string
  sign: string
}

export type MountDetails = {
  total_space?: number
  free_space?: number
  used_space?: number
  driver_name: string
}

export type ArchiveList = PageResp<Obj>
