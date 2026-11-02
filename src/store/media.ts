import { createSignal } from "solid-js"
import type { MediaType } from "~/types"

export interface MediaStatus {
  enabled: boolean
  types: MediaType[]
  emby_enabled: boolean
  subsonic_enabled: boolean
  emby_base_url: string
  subsonic_base_url: string
  strm_path: string
  strm_on_scan: boolean
  strm_same_dir: boolean
  thumb_path: string
  version: string
  proxy_cover: boolean
}

const emptyStatus: MediaStatus = {
  enabled: false,
  types: [],
  emby_enabled: false,
  subsonic_enabled: false,
  emby_base_url: "",
  subsonic_base_url: "",
  strm_path: "",
  strm_on_scan: false,
  strm_same_dir: true,
  thumb_path: "/imgs",
  version: "",
  proxy_cover: false,
}

const [mediaStatus, setMediaStatusRaw] = createSignal<MediaStatus>(emptyStatus)

/** 后端可能返回 types: null（旧版本/未启用），统一归一化，避免 .includes 崩溃 */
export const setMediaStatus = (status?: Partial<MediaStatus> | null) => {
  if (!status) {
    setMediaStatusRaw(emptyStatus)
    return
  }
  setMediaStatusRaw({
    ...emptyStatus,
    ...status,
    types: Array.isArray(status.types) ? status.types : [],
  })
}

/** 某个媒体类型是否启用 */
export const mediaTypeEnabled = (type: MediaType) =>
  mediaStatus().types.includes(type)

export { mediaStatus }
