// The prototype only reads. It runs against real servers, the user's own
// among them, so every API call it makes goes through this list: listing,
// file info, playback sources, the media library's reads, signing in and out.
// Anything else (creating a share, ...) is stopped here before it leaves the
// page, whatever screen asked for it. Downloads and playback use the file
// links (/d, /p), not this API, and are untouched.
import { r } from "~/utils"

const READS = [
  /^\/fs\/(list|get|video_play|video_subtitle)$/,
  /^\/fs\/media\//,
  /^\/auth\/login\/hash$/,
  /^\/auth\/logout$/,
  /^\/me$/,
  /^\/public\//,
]

export const READ_ONLY_MESSAGE = "原型只读，不执行会改动服务器的操作"

export const isRead = (url: string) =>
  READS.some((re) => re.test(url.split("?")[0]!.replace(/^.*\/api(?=\/)/, "")))

export const installReadOnly = () => {
  r.interceptors.request.use((config) => {
    if (isRead(config.url ?? "")) return config
    return Promise.reject(new Error(`${READ_ONLY_MESSAGE}: ${config.url}`))
  })
}
