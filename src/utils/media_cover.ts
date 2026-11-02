import { api } from "./config"
import { mediaStatus } from "~/store/media"

/** 带封面的媒体对象：条目、专辑、播放列表项都满足 */
export interface MediaCoverSource {
  cover?: string
  cover_url?: string
}

/**
 * 媒体封面地址解析：
 * - 后端返回了 cover_url 就直接用它（已带签名，可直接请求）
 * - 否则按 cover 的形式自己拼：
 * - data:/blob: 直接使用（base64 模式）
 * - thumb:/imgs/x.jpg 运行目录模式，走本地缩略图接口
 * - /d/... 挂载目录（VFS）模式，补全站点地址后由 /d 直链返回
 * - http(s) 外链，按设置决定是否走服务端代理
 */
export const resolveMediaCover = (source?: MediaCoverSource): string => {
  if (source?.cover_url) return source.cover_url
  return coverFromRaw(source?.cover)
}

// TODO: 后端合并（后端规格 4.7）开始返回 cover_url 之后，删掉本函数和上面的回退，
// 只留 cover_url。
const coverFromRaw = (cover?: string): string => {
  if (!cover) return ""
  if (cover.startsWith("data:") || cover.startsWith("blob:")) return cover
  if (cover.startsWith("thumb:")) {
    return `${api}/api/public/media/thumb?path=${encodeURIComponent(cover.slice(6))}`
  }
  if (/^https?:\/\//i.test(cover)) {
    // 是否走服务端代理由设置决定，默认直接使用原始地址
    return mediaStatus().proxy_cover
      ? `${api}/api/public/media/proxy?url=${encodeURIComponent(cover)}`
      : cover
  }
  if (cover.startsWith("/")) return `${api}${cover}`
  return cover
}
