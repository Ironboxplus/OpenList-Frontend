// 媒体库类型定义

export type MediaType = "video" | "music" | "image" | "book"

// 选集信息（路径合并模式下文件夹内的每个媒体文件）
export interface EpisodeInfo {
  file_name: string // 原始文件名（含扩展名）
  index: number // 序号，默认0，文件名开头有数字则取该数字
  title: string // 选集标题（去掉序号后的文件名，不含扩展名）
  /** 同一部电影的另一个版本（不是剧集的一集） */
  version?: boolean
}

export interface MediaItem {
  id: number
  created_at: string
  updated_at: string
  media_type: MediaType
  scan_path_id: number
  file_name: string
  file_size: number
  mime_type: string
  hidden: boolean
  // 刮削信息
  scraped_name: string
  /** The title to show, chosen by the backend's media_title_source setting. */
  display_title?: string
  /** The other title (original or scraped), shown muted on the detail page. */
  alt_title?: string
  description: string
  cover: string
  /** 后端给出的可直接使用的（带签名的）封面地址；有则优先于 cover */
  cover_url?: string
  release_date: string
  rating: number
  genre: string
  authors: string // JSON数组字符串
  plot: string
  reviews: string
  external_id: string
  // 音乐
  album_name: string
  album_artist: string
  track_number: number
  duration: number
  lyrics: string
  // 视频
  video_type: string
  season: number
  episode: number
  // 书籍
  publisher: string
  isbn: string
  // 目录
  is_folder: boolean
  folder_path: string // 扫描根路径（恒定为扫描路径，与 file_name + album_name 组合唯一）
  episodes: string // 选集信息 JSON 字符串，格式：[{file_name,index,title},...]
  scraped_at: string | null
  // ---- 识别与整理（后端 internal/model/media_curation.go 的 MediaCuration） ----
  original_title?: string
  /** JSON 字符串：{"tmdb":"tv/890","imdb":"tt0112159",...}，用 parseExternalIds 解析 */
  external_ids?: string
  backdrop?: string
  /** manual | rule | scraper */
  source?: string
  /** 规则或匹配有多确定，0-1；低于 MEDIA_PENDING_CONFIDENCE 算待确认 */
  confidence?: number
  /** 锁定后扫描和刮削不再覆盖已刮削的字段 */
  locked?: boolean
  /** JSON 字符串，只有管理员收得到；用 parseCandidates 解析 */
  candidates?: string
  // ---- 公开接口附带的视图字段（server/handles/media_view.go 的 MediaItemView） ----
  /** 条目所在路径，相对用户的 base path */
  path?: string
  /** 多源评分，来源 tmdb/douban/imdb/bgm/rt；只有文字时（如 "93%"）为字符串 */
  ratings?: Record<string, number | string>
  backdrop_url?: string
  /** 仅合集：最多 4 张成员封面 */
  child_posters?: string[]
  /** 同一部电影有几个版本；多于一个时才有 */
  versions?: number
  /** 仅详情：按集列表 */
  episode_list?: MediaEpisodeView[]
}

/** 后端的 MediaPendingConfidence：低于它（且没锁定）的条目等人确认。 */
export const MEDIA_PENDING_CONFIDENCE = 0.6

/** 视频条目的 video_type：movie/tv/anime/collection，ignore 是被规则判为非作品的目录（不会列出）。 */
export type VideoKind = "movie" | "tv" | "anime" | "collection" | "ignore"

/** 一集（详情接口的 episode_list）。 */
export interface MediaEpisodeView {
  file_name: string
  season: number
  episode: number
  title: string
  overview: string
  still_url?: string
  /** 电影的一个版本，不是剧集的一集 */
  version?: boolean
}

/** 低置信度时给人选的候选（后端 model.MediaCandidate）。 */
export interface MediaCandidate {
  provider: string
  id: string
  title: string
  year: number
  poster_url: string
  score: number
}

const parseJSON = <T>(raw: string | undefined, fallback: T): T => {
  if (!raw) return fallback
  try {
    const v = JSON.parse(raw)
    return v === null || typeof v !== typeof fallback ? fallback : (v as T)
  } catch {
    return fallback
  }
}

export const parseExternalIds = (
  item: Pick<MediaItem, "external_ids">,
): Record<string, string> => parseJSON(item.external_ids, {})

export const parseCandidates = (
  item: Pick<MediaItem, "candidates">,
): MediaCandidate[] => {
  const v = parseJSON<unknown>(item.candidates, [])
  return Array.isArray(v) ? (v as MediaCandidate[]) : []
}

/** 没锁定，且置信度低或有候选：等人确认。 */
export const isPendingMedia = (item: MediaItem): boolean =>
  !item.locked &&
  ((item.confidence ?? 1) < MEDIA_PENDING_CONFIDENCE ||
    parseCandidates(item).length > 0)

// 解析 episodes JSON 字符串。
// JSON 合法但不是数组（如 "{}"）时必须返回空数组：调用方会直接当列表用（.length / <For>），
// 非数组会让选集渲染或分页计算直接炸掉。
export function parseEpisodes(episodes: string): EpisodeInfo[] {
  if (!episodes) return []
  try {
    const parsed = JSON.parse(episodes)
    return Array.isArray(parsed) ? (parsed as EpisodeInfo[]) : []
  } catch {
    return []
  }
}

export interface AlbumInfo {
  album_name: string
  album_artist: string
  cover: string
  cover_url?: string
  release_date: string
  track_count: number
  scan_path_id: number
}

export interface MediaConfig {
  id?: number
  media_type: MediaType
  enabled: boolean
  last_scan_at: string | null
  last_scrape_at: string | null
  /** 该类型独立的刮削配置 JSON：store_thumbnail / thumbnail_mode / thumbnail_path */
  scraper_config?: string
}

// 扫描路径配置
export interface MediaScanPath {
  id?: number
  media_type: MediaType
  name: string
  path: string
  path_merge: boolean
  type_tag: string // 类型标签：电影、电视剧等
  content_tags: string // 内容标签：喜剧、惊悚等（逗号分隔）
  enable_scrape: boolean
  last_scan_at: string | null
}

export interface MediaScanProgress {
  media_type: MediaType
  scan_path_id?: number
  running: boolean
  total: number
  done: number
  message: string
  error?: string
}

export interface MediaListQuery {
  media_type?: MediaType
  scan_path_id?: number
  page?: number
  page_size?: number
  order_by?: "name" | "date" | "size"
  order_dir?: "asc" | "desc"
  folder_path?: string
  keyword?: string
  type_tag?: string
  content_tag?: string
  /** 视频的 video_type，逗号分隔，如 "movie,anime" */
  kind?: string
  /** 某目录下的子项，相对用户的 base path */
  path?: string
}

// 解析 authors JSON 字符串。
// 同样要求解析结果是数组：非法 JSON 或非数组都回退成原始字符串，
// 否则调用方拿到的不是 string[]，.slice / .join 会直接报错。
export function parseAuthors(authors: string): string[] {
  if (!authors) return []
  try {
    const parsed = JSON.parse(authors)
    if (Array.isArray(parsed)) {
      return parsed.map((a) => String(a))
    }
    return [authors]
  } catch {
    return [authors]
  }
}

// 格式化时长（秒 -> mm:ss）
export function formatDuration(seconds: number): string {
  if (!seconds) return "0:00"
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, "0")}`
}

// 获取媒体显示名称：后端按 media_title_source 给出的 display_title 优先
export function mediaTitle(item: MediaItem): string {
  return item.display_title || item.scraped_name || item.file_name || ""
}

/** Kept for the call sites that predate mediaTitle. */
export const getMediaName = mediaTitle

// 获取媒体文件的VFS路径（folder_path + "/" + file_name）
// 可选传入 episodeFileName 用于播放文件夹条目中的某个选集
export function getMediaFilePath(
  item: MediaItem,
  episodeFileName?: string,
): string {
  const folder = item.folder_path?.replace(/\/$/, "") ?? ""
  const fileName = episodeFileName ?? item.file_name ?? ""
  if (!fileName) return folder
  return `${folder}/${fileName}`
}

// 媒体类型标签
export const mediaTypeLabels: Record<MediaType, string> = {
  video: "影视",
  music: "音乐",
  image: "图片",
  book: "书籍",
}
