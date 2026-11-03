import { resolveMediaCover } from "~/utils/media_cover"
import { accentGradient } from "~/utils/accent"
import {
  createSignal,
  createResource,
  createMemo,
  createEffect,
  on,
  Show,
  For,
  onMount,
  onCleanup,
  lazy,
  Switch,
  Match,
} from "solid-js"
import { useColorMode } from "@hope-ui/solid"
import {
  TbArrowLeft,
  TbLock,
  TbMovie,
  TbPencil,
  TbPlayerPlay,
  TbStar,
  TbStarFilled,
} from "solid-icons/tb"
import { Button } from "~/components/ui/button"
import { cn } from "~/utils/cn"
import { Portal } from "solid-js/web"
import { MediaLayout } from "../MediaLayout"
import { MediaBrowser } from "../MediaBrowser"
import { formatMediaSize, mediaChip } from "../ui"
import {
  downloadMediaStrm,
  getMediaItem,
  getMediaList,
  getMediaProgress,
  getMediaUserData,
  getSignedProxyUrl,
  mediaItemPath,
  requestTranscodePlay,
  saveMediaProgress,
  setMediaFavorite,
} from "~/utils/media_api"
import type { MediaItem, EpisodeInfo } from "~/types"
import {
  getMediaName,
  isPendingMedia,
  parseAuthors,
  parseEpisodes,
  UserMethods,
} from "~/types"
import { me } from "~/store"
import { fromMediaItem } from "~/features/media/editor-item"
import { cardRating, ratingBadges } from "~/features/media/logic"
import { CoverMosaic } from "./CoverMosaic"
import { RatingBadges } from "./RatingBadges"
import { episodeRows, episodeText, type EpisodeRow } from "./episodes"
import { VersionPicker } from "./VersionPicker"
import { MediaMovi } from "./MediaMovi"
import {
  isVersionSet,
  versionCount,
  versionLabels,
  versionRows,
} from "./versions"
import {
  getPlayerChoice,
  pickEngine,
  setPlayerChoice,
  type PlayerChoice,
} from "./player-choice"
import { videoKindLabel } from "./videoKind"
import { base_path, ext, notify } from "~/utils"
import { useT } from "~/hooks"
import { OpenWithPlayer } from "~/components/OpenWithPlayer"
import { MediaPlayButton } from "~/components/MediaPlayButton"
import Artplayer from "artplayer"
import artplayerProxyMediabunny from "~/components/artplayer-proxy-mediabunny"
import { attachMediabunnyAudio } from "~/components/artplayer-proxy-mediabunny/AudioPatch"
import Hls from "hls.js"
import mpegts from "mpegts.js"
import { registerAc3Decoder } from "@mediabunny/ac3"

// MediaBunny 播放器模式：三档选择
//   "disabled"   - 禁用（使用原生 <video>，默认）
//   "audio_only" - 仅解码音频（原生 <video> 解码画面 + mediabunny 单独提供音轨）
//   "full"       - 全部解码（mediabunny 接管，音频 + 视频均由 mediabunny）
const MEDIABUNNY_KEY = "use_mediabunny_player"
type MediaBunnyMode = "disabled" | "audio_only" | "full"
function getMediaBunnyMode(): MediaBunnyMode {
  const v = localStorage.getItem(MEDIABUNNY_KEY)
  if (v === "audio_only") return "audio_only"
  // 向下兼容旧版 "true/false" 布尔值
  if (v === "true" || v === "full") return "full"
  return "disabled"
}
function setMediaBunnyMode(mode: MediaBunnyMode) {
  localStorage.setItem(MEDIABUNNY_KEY, mode)
}
function isMediaBunnyEnabled(): boolean {
  return getMediaBunnyMode() !== "disabled"
}
const mediabunnyModeKey = (m: MediaBunnyMode) =>
  m === "disabled"
    ? "media.video.decode_disabled"
    : m === "audio_only"
      ? "media.video.decode_audio_only"
      : "media.video.decode_all"
// AC3 解码器改为按需注册：模块 import 期不产生任何副作用。
// force=true 用于 AC3 自动回退路径：即使播放器模式是 disabled，
// 回退也会用 mediabunny 解音轨，此时必须注册解码器。
let ac3Registered = false
function ensureAc3Decoder(force = false) {
  if (ac3Registered) return
  if (!force && !isMediaBunnyEnabled()) return
  ac3Registered = true
  registerAc3Decoder()
}

// ==================== 视频卡片 ====================
const VideoCard = (props: { item: MediaItem }) => {
  const t = useT()
  const { colorMode } = useColorMode()
  const isDark = createMemo(() => colorMode() === "dark")
  const cardBg = createMemo(() =>
    isDark() ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
  )
  const cardBorder = createMemo(() =>
    isDark() ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.08)",
  )
  const coverBg = createMemo(() => (isDark() ? "#1e293b" : "#e2e8f0"))
  const titleColor = createMemo(() => (isDark() ? "#e2e8f0" : "#1e293b"))
  const subColor = createMemo(() => (isDark() ? "#64748b" : "#94a3b8"))
  const name = () => getMediaName(props.item)
  const [hover, setHover] = createSignal(false)
  const authors = () => parseAuthors(props.item.authors)
  // 目录聚合条目没有有意义的单文件大小，改为显示集数
  const episodeCount = () => parseEpisodes(props.item.episodes).length
  const sizeText = () =>
    versionCount(props.item) > 0
      ? t("media.video.versions", { n: versionCount(props.item) })
      : episodeCount() > 0
        ? t("media.video.episodes_n", { n: episodeCount() })
        : formatMediaSize(props.item.file_size)
  return (
    <div
      style={{
        background: cardBg(),
        "border-radius": "12px",
        overflow: "hidden",
        border: `1px solid ${cardBorder()}`,
        transition: "transform 0.2s, box-shadow 0.2s",
      }}
      onMouseEnter={(e) => {
        setHover(true)
        e.currentTarget.style.transform = "translateY(-4px)"
        e.currentTarget.style.boxShadow = isDark()
          ? "0 12px 32px rgba(0,0,0,0.4)"
          : "0 12px 32px rgba(0,0,0,0.15)"
      }}
      onMouseLeave={(e) => {
        setHover(false)
        e.currentTarget.style.transform = "translateY(0)"
        e.currentTarget.style.boxShadow = "none"
      }}
    >
      {/* 封面 */}
      <div
        style={{
          position: "relative",
          "padding-top": "150%",
          background: coverBg(),
        }}
      >
        <Show
          when={
            resolveMediaCover(props.item) ||
            (props.item.child_posters ?? []).length > 0
          }
          fallback={
            <div
              style={{
                position: "absolute",
                inset: "0",
                display: "flex",
                "align-items": "center",
                "justify-content": "center",
                color: subColor(),
              }}
            >
              <TbMovie class="size-12" />
            </div>
          }
        >
          {/* 合集没有自己的封面：成员封面拼成 2x2，只有一张时直接用它 */}
          <Show
            when={
              !resolveMediaCover(props.item) &&
              (props.item.child_posters ?? []).length > 1
            }
            fallback={
              <img
                src={
                  resolveMediaCover(props.item) || props.item.child_posters?.[0]
                }
                alt={name()}
                style={{
                  position: "absolute",
                  inset: "0",
                  width: "100%",
                  height: "100%",
                  "object-fit": "cover",
                }}
                loading="lazy"
              />
            }
          >
            <div style={{ position: "absolute", inset: "0" }}>
              <CoverMosaic
                urls={props.item.child_posters ?? []}
                width="100%"
                height="100%"
                radius="0"
                flat
              />
            </div>
          </Show>
        </Show>
        {/* 评分角标 */}
        <Show when={cardRating(props.item.ratings) || props.item.rating > 0}>
          <div
            style={{
              position: "absolute",
              top: "8px",
              left: "8px",
              background: "rgba(0,0,0,0.7)",
              "border-radius": "6px",
              padding: "2px 6px",
              "font-size": "11px",
              color: "#fbbf24",
              "font-weight": "600",
            }}
          >
            <TbStarFilled class="mr-1 inline size-3 align-[-1px]" />
            {cardRating(props.item.ratings)?.text ??
              props.item.rating.toFixed(1)}
          </div>
        </Show>
        {/* 悬浮详情 */}
        <Show when={hover()}>
          <div
            style={{
              position: "absolute",
              inset: "0",
              display: "flex",
              "flex-direction": "column",
              "justify-content": "flex-end",
              gap: "5px",
              padding: "12px",
              background:
                "linear-gradient(to top, rgba(0,0,0,0.94), rgba(0,0,0,0.55) 55%, rgba(0,0,0,0.1))",
              color: "#e2e8f0",
              "font-size": "11px",
              "line-height": "1.5",
              "pointer-events": "none",
            }}
          >
            <Show when={authors().length > 0}>
              <div
                style={{
                  overflow: "hidden",
                  "text-overflow": "ellipsis",
                  "white-space": "nowrap",
                }}
              >
                {t("media.video.cast")}
                {authors().slice(0, 4).join(" / ")}
              </div>
            </Show>
            <Show when={props.item.plot || props.item.description}>
              <div
                style={{
                  display: "-webkit-box",
                  "-webkit-line-clamp": "4",
                  "-webkit-box-orient": "vertical",
                  overflow: "hidden",
                  color: "rgba(226,232,240,0.8)",
                }}
              >
                {props.item.plot || props.item.description}
              </div>
            </Show>
            <div
              style={{
                color: "rgba(148,163,184,0.9)",
                "font-size": "10px",
              }}
            >
              {[
                props.item.release_date?.slice(0, 4),
                props.item.genre,
                sizeText(),
              ]
                .filter(Boolean)
                .join(" · ")}
            </div>
          </div>
        </Show>
      </div>
      {/* 信息 */}
      <div style={{ padding: "10px 12px" }}>
        <div
          style={{
            color: titleColor(),
            "font-size": "13px",
            "font-weight": "500",
            overflow: "hidden",
            "text-overflow": "ellipsis",
            "white-space": "nowrap",
            "margin-bottom": "4px",
          }}
          title={name()}
        >
          {name()}
        </div>
        <div
          style={{
            color: subColor(),
            "font-size": "11px",
            overflow: "hidden",
            "text-overflow": "ellipsis",
            "white-space": "nowrap",
          }}
          title={[
            props.item.release_date?.slice(0, 4),
            props.item.genre,
            sizeText(),
          ]
            .filter(Boolean)
            .join(" · ")}
        >
          {[
            props.item.release_date?.slice(0, 4),
            props.item.genre?.split(",")[0],
            sizeText(),
          ]
            .filter(Boolean)
            .join(" · ")}
        </div>
      </div>
    </div>
  )
}

// ==================== 内嵌视频播放器 ====================
// 云端转码的决策结果：由覆盖层先问好，再决定用哪个播放器
interface TranscodeDecision {
  masterUrl: string
  jobId?: string
  profile?: string
}

/** Artplayer 引擎：直链、HLS、mpegts、mediabunny 与云端转码都在这里 */
const ArtplayerView = (props: {
  item: MediaItem
  // 可选：指定播放的文件路径和标题（用于选集播放）
  filePath?: string
  title?: string
  episodeIndex?: number
  resumeSeconds: number
  transcode?: TranscodeDecision
  onTime: (seconds: number) => void
}) => {
  const t = useT()
  let playerContainer: HTMLDivElement | undefined
  let player: Artplayer | undefined
  let hlsPlayer: Hls | null | undefined
  let flvPlayer: mpegts.Player | undefined
  // 卸载标记：onMount 中有多处 await，期间用户可能已离开，
  // 此时 onCleanup 已执行，之后创建的实例不会再被销毁。
  let disposed = false

  // 播放文件的 VFS 路径：优先使用传入的 filePath，否则 folder_path + "/" + file_name
  const videoPath = () => props.filePath ?? mediaItemPath(props.item)
  // 签名 + 编码后的代理地址，在 onMount 里异步取得
  let directUrl = ""
  const videoUrl = () => directUrl
  const videoTitle = () => props.title ?? getMediaName(props.item)

  onMount(async () => {
    if (!playerContainer) return
    let fileExt = ext(props.item.file_name)
    directUrl = await getSignedProxyUrl(videoPath())
    if (disposed || !playerContainer) return

    // 续播位置与云端转码决策由覆盖层取得（见 VideoPlayer）
    const resumeSeconds = props.resumeSeconds
    let useTranscode = false
    let actualUrl = videoUrl()
    if (props.transcode) {
      useTranscode = true
      actualUrl = props.transcode.masterUrl
      fileExt = "m3u8"
      console.log(
        `[transcode] 媒体库使用云端转码播放: job=${props.transcode.jobId}, profile=${props.transcode.profile}`,
      )
    }

    // 【预加载策略】
    // 1. 不在创建播放器时主动预取，避免点击视频立即触发数据加载；
    // 2. <video> 设为 preload="none"，浏览器不会自动 metadata/auto；
    // 3. HLS 模式下使用 autoStartLoad=false，attachMedia 不会立刻拉切片；
    //    在用户点击播放时才开始加载，且初始仅缓冲约 1 个分块；
    //    待第一个分块开始播放后再放宽缓冲到约 10 个分块顺序缓存。

    ensureAc3Decoder()
    player = new Artplayer({
      container: playerContainer,
      url: actualUrl,
      title: videoTitle(),
      volume: 1.0,
      autoplay: true,
      autoSize: false,
      loop: false,
      flip: true,
      playbackRate: true,
      aspectRatio: true,
      screenshot: true,
      setting: true,
      hotkey: true,
      pip: true,
      fullscreen: true,
      fullscreenWeb: true,
      mutex: true,
      playsInline: true,
      type: fileExt,
      // 【重要】转码模式下一律使用 HLS.js，不使用 mediabunny proxy，
      // 避免 proxy 与 HLS.js 同时接管 video 元素导致双重加载、重复请求。
      // 只有直链播放且 mediabunny=full 时才启用 proxy。
      ...(!useTranscode && getMediaBunnyMode() === "full"
        ? { proxy: artplayerProxyMediabunny() }
        : {}),
      customType: {
        m3u8: (video: HTMLMediaElement, src: string, art: Artplayer) => {
          // 【重复创建保护】customType 可能被 Artplayer 多次触发（如 url 刷新、
          // proxy + customType 冲突），创建多个 Hls 实例会导致同一个 video
          // 元素上多个 HLS.js 并发拉取 playlist 和切片，产生请求风暴。
          if (hlsPlayer) {
            console.warn(
              "[hls] customType triggered again, destroying previous instance",
            )
            hlsPlayer.destroy()
            hlsPlayer = undefined
          }
          // 【按需加载策略】
          //   - autoStartLoad=false：attachMedia 后不会立即拉取切片，
          //     等用户点击播放时再 startLoad()，避免点开视频就开始下载。
          //   - 初始 maxBufferLength=1 秒：仅触发第一个分块加载即可起播；
          //     播放开始后会被动态扩大到 INITIAL → FULL（见下方 play 事件）。
          //   - 顺序缓存最多约 10 个分块：常见转码切片为 6 秒/块，
          //     因此 FULL_BUFFER_SECONDS = 6 * 10 = 60 秒。
          const INITIAL_BUFFER_SECONDS = 1
          const FULL_BUFFER_SECONDS = 60
          hlsPlayer = new Hls({
            // 关键：禁止 attachMedia 后自动加载 manifest/切片
            autoStartLoad: false,
            // 起步缓冲极小，仅够拉一个分块即可起播
            maxBufferLength: INITIAL_BUFFER_SECONDS,
            maxMaxBufferLength: INITIAL_BUFFER_SECONDS,
            maxBufferSize: 16 * 1024 * 1024,
            maxBufferHole: 0.5,
            levelLoadingMaxRetry: 4,
            levelLoadingRetryDelay: 1000,
            progressive: false,
            enableWorker: false,
            fragLoadingMaxRetry: 4,
            fragLoadingRetryDelay: 1000,
            backBufferLength: 60,
            liveSyncDuration: 6,
            liveMaxLatencyDuration: 30,
          })

          // ---- 防止 play() 与 HLS.js load 竞态 ----
          // HLS.js attachMedia 会异步接管 video 媒体源，在 manifest 解析完成前
          // 任何 play() 调用都会被浏览器中断并抛出 AbortError。
          // 解决方案：拦截 video.play()，在第一次播放时启动 HLS 加载，
          // 在 manifest 就绪前将 play 请求排队，就绪后自动执行。
          let hlsReady = false
          let pendingPlay = false
          let loadStarted = false // 是否已调用 startLoad（懒加载触发标志）
          let bufferExpanded = false // 是否已把缓冲扩大到 FULL
          const origPlay = video.play.bind(video)
          const ensureLoadStarted = () => {
            if (loadStarted || !hlsPlayer) return
            loadStarted = true
            console.debug("[hls] startLoad() triggered by play()")
            try {
              hlsPlayer.startLoad(0)
            } catch (e) {
              console.warn("[hls] startLoad failed:", e)
            }
          }
          video.play = function () {
            // 用户点击播放时才真正开始加载切片
            ensureLoadStarted()
            if (hlsReady) {
              return origPlay()
            }
            // manifest 尚未就绪，记录待播放状态，稍后自动触发
            pendingPlay = true
            console.debug("[hls] play() deferred, waiting for manifest")
            return Promise.resolve()
          } as typeof video.play

          // attachMedia 之前 loadSource 即可，autoStartLoad=false
          // 保证 attachMedia 不会自动开始下载
          hlsPlayer.loadSource(src)
          hlsPlayer.attachMedia(video)

          // 第一个切片开始播放后，把缓冲放宽到 ~10 个分块（约 60 秒）顺序缓存
          const expandBufferOnPlaying = () => {
            if (bufferExpanded || !hlsPlayer) return
            bufferExpanded = true
            try {
              const cfg: any = hlsPlayer.config
              cfg.maxBufferLength = FULL_BUFFER_SECONDS
              cfg.maxMaxBufferLength = FULL_BUFFER_SECONDS
              cfg.maxBufferSize = 60 * 1024 * 1024
              console.debug(
                `[hls] buffer expanded to ${FULL_BUFFER_SECONDS}s (~10 fragments)`,
              )
            } catch (e) {
              console.warn("[hls] expand buffer failed:", e)
            }
          }
          video.addEventListener("playing", expandBufferOnPlaying, {
            once: true,
          })

          // ---- 【最终兜底】单切片请求次数限流 ----
          // 无论什么原因（codec 不匹配、recoverMediaError 死循环、buffer append 失败等），
          // 如果同一个切片 URL 被请求超过 5 次，说明已经陷入无法恢复的死循环，
          // 直接销毁 hls 实例，避免后端被请求洪水冲垮。
          const fragRequestCount = new Map<string, number>()
          const MAX_PER_FRAG = 5
          hlsPlayer.on(Hls.Events.FRAG_LOADING, (_: any, data: any) => {
            const url = data?.frag?.url || data?.frag?.relurl || ""
            if (!url) return
            const cnt = (fragRequestCount.get(url) || 0) + 1
            fragRequestCount.set(url, cnt)
            if (cnt > MAX_PER_FRAG) {
              console.error(
                `[hls] fragment requested ${cnt} times, aborting to prevent flood: ${url}`,
              )
              if (hlsPlayer) {
                hlsPlayer.destroy()
                hlsPlayer = undefined
              }
              hlsReady = true
              video.play = origPlay
              // 提示用户
              try {
                art.notice.show = t("media.video.hls_broken")
              } catch {
                // ignore
              }
            }
          })

          hlsPlayer.on(Hls.Events.MANIFEST_PARSED, () => {
            console.debug("[hls] manifest parsed, ready to play")
            hlsReady = true
            // 恢复原始 play 方法
            video.play = origPlay
            // 如果在等待期间有 play 请求，现在执行
            if (pendingPlay) {
              pendingPlay = false
              origPlay().catch((e: any) => {
                // 忽略用户手势限制等非致命错误
                if (e.name !== "AbortError") {
                  console.warn("[hls] deferred play failed:", e)
                }
              })
            }
          })

          // ---- HLS.js 错误恢复（带限流，防止坏切片导致死循环）----
          let recoverCount = 0
          let lastRecoverAt = 0
          let swapAudioCodecTried = false
          hlsPlayer.on(Hls.Events.ERROR, (_: any, data: any) => {
            if (!data.fatal) return
            console.error("[hls] fatal error:", data.type, data.details)
            if (data.type === Hls.ErrorTypes.MEDIA_ERROR && hlsPlayer) {
              const now = Date.now()
              // 距离上次恢复 <3s 视为同一坏切片，累计计数；否则重置
              if (now - lastRecoverAt < 3000) {
                recoverCount++
              } else {
                recoverCount = 1
              }
              lastRecoverAt = now
              if (recoverCount === 1) {
                console.warn("[hls] recoverMediaError() #1")
                hlsPlayer.recoverMediaError()
              } else if (recoverCount === 2 && !swapAudioCodecTried) {
                console.warn("[hls] recoverMediaError() #2 + swapAudioCodec()")
                swapAudioCodecTried = true
                hlsPlayer.swapAudioCodec()
                hlsPlayer.recoverMediaError()
              } else {
                // 超过 2 次连续 media error → 放弃，避免后端切片被无限请求
                console.error(
                  "[hls] media error unrecoverable, giving up to prevent request flood",
                )
                hlsPlayer.destroy()
                hlsPlayer = null
                hlsReady = true
                video.play = origPlay
              }
            } else {
              hlsReady = true
              video.play = origPlay // 恢复，避免永久拦截
            }
          })
          // 注意：不要手动设置 video.src，HLS.js attachMedia 已接管媒体源
          // 手动赋值会导致 video 重新加载，与 Artplayer 的 play() 产生竞态
        },
        flv: (video: HTMLMediaElement, src: string) => {
          flvPlayer = mpegts.createPlayer({ type: "flv", url: src })
          flvPlayer.attachMediaElement(video)
          flvPlayer.load()
        },
      },
      moreVideoAttr: {
        // @ts-ignore
        "webkit-playsinline": true,
        playsInline: true,
        // 【预加载控制】
        // - 转码模式：HLS.js 接管媒体源，preload 对其无实质影响；
        // - 直链模式：preload="none" 使浏览器在点击播放前不加载任何数据，
        //   避免进入页面立即产生多个范围请求。点击播放后浏览器
        //   会自动按需拉取，不会一次性下载过多。
        preload: "none",
      },
      settings: [
        {
          id: "setting_mediabunny",
          html: t("media.video.mediabunny_player"),
          tooltip: t(mediabunnyModeKey(getMediaBunnyMode())),
          icon: '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>',
          selector: (
            ["disabled", "audio_only", "full"] as MediaBunnyMode[]
          ).map((m) => ({
            html: t(mediabunnyModeKey(m)),
            name: m,
            default: getMediaBunnyMode() === m,
          })),
          onSelect: function (item: any) {
            const newMode = item.name as MediaBunnyMode
            setMediaBunnyMode(newMode)
            setTimeout(() => {
              if (confirm(t("media.video.mode_reload_confirm"))) {
                location.reload()
              }
            }, 100)
            return t(mediabunnyModeKey(newMode))
          },
        },
      ],
    })

    // Artplayer 默认在媒体就绪前一直显示加载转圈；HLS 采用懒加载（点击播放才开始拉流），
    // 初始阶段必须隐藏加载层，只在真正开始缓冲/播放时显示，避免页面一打开就一直转圈。
    player.loading.show = false
    // 不再用 Artplayer 的加载层：它会在未起播时一直转圈并挡住中间的播放按钮
    player.on("video:playing", () => {
      if (player) player.loading.show = false
    })
    // 部分浏览器会拦截自动播放：失败时保持暂停，用户点击中间的播放键即可
    player.on("ready", () => {
      player?.play().catch(() => {
        /* autoplay blocked */
      })
    })
    player.on("video:canplay", () => {
      if (player) player.loading.show = false
    })
    player.on("video:error", () => {
      if (player) player.loading.show = false
    })

    // ---- 播放进度：续播 + 定时上报（与 Emby 共用 user_data）----
    let lastSavedAt = 0
    let resumed = false
    const persistProgress = (played = false) => {
      if (!player) return
      const duration = player.duration || 0
      const position = player.currentTime || 0
      if (position < 2 && !played) return
      saveMediaProgress({
        item_id: props.item.id,
        episode_index: props.episodeIndex ?? 0,
        position,
        duration,
        played,
      }).catch(() => {
        /* ignore */
      })
    }
    player.on("video:playing", () => {
      if (!resumed && resumeSeconds > 5) {
        player!.seek = resumeSeconds
        resumed = true
      }
    })
    player.on("video:timeupdate", () => {
      props.onTime(player?.currentTime || 0)
      const now = Date.now()
      if (now - lastSavedAt < 10_000) return
      lastSavedAt = now
      persistProgress()
    })
    player.on("video:pause", () => persistProgress())
    player.on("video:ended", () => persistProgress(true))
    onCleanup(() => persistProgress())

    // "仅音频"模式：原生 <video> 负责视频解码，mediabunny 只提供音轨。
    // 仅在直链模式下生效，转码模式已经是 HLS 流，不需要 mediabunny 音频补丁。
    if (!useTranscode && getMediaBunnyMode() === "audio_only") {
      attachMediabunnyAudio(player, videoUrl())
    }

    // 默认禁用 MediaBunny 时，仍自动检测浏览器不支持的音频（AC3/EAC3/DTS 等）：
    // 播放几秒后音频解码字节数仍为 0，或浏览器明确报告无音频轨，则自动挂载 MediaBunny 音轨。
    if (!useTranscode && getMediaBunnyMode() === "disabled") {
      let audioPatched = false
      const patchAudio = () => {
        if (audioPatched || !player) return
        audioPatched = true
        // 模式为 disabled 时 ensureAc3Decoder() 默认不会注册；回退路径要强制注册，
        // 否则 AC3/EAC3 这类音轨即使挂上 MediaBunny 也解不出来
        ensureAc3Decoder(true)
        attachMediabunnyAudio(player, videoUrl())
        player.notice.show = t("media.video.audio_fallback")
      }
      const detectUnsupportedAudio = () => {
        if (audioPatched || !player) return
        const video = player.video as HTMLVideoElement & {
          mozHasAudio?: boolean
          webkitAudioDecodedByteCount?: number
        }
        if (!video) return
        // Firefox 会明确告知是否存在音频轨
        if (video.mozHasAudio === false) {
          patchAudio()
          return
        }
        // Chromium：播放数秒后音频解码字节数仍为 0，说明浏览器丢弃了音轨
        const decoded = video.webkitAudioDecodedByteCount
        if (
          typeof decoded === "number" &&
          video.currentTime > 3 &&
          decoded === 0
        ) {
          patchAudio()
        }
      }
      player.on("video:timeupdate", detectUnsupportedAudio)
    }
  })

  onCleanup(() => {
    disposed = true
    // 先销毁 HLS/FLV 播放器，再销毁 Artplayer
    // 避免 Artplayer destroy 时触发 video.src 变更导致多余的 load 事件
    if (hlsPlayer) {
      hlsPlayer.destroy()
      hlsPlayer = undefined
    }
    if (flvPlayer) {
      flvPlayer.destroy()
      flvPlayer = undefined
    }
    if (player) {
      player.destroy()
      player = undefined
    }
  })

  return (
    <div style={{ width: "100%", height: "100%" }}>
      {/* Artplayer 自带加载层在自动播放被拦截时会一直转圈，直接隐藏 */}
      <style>{`.art-loading { display: none !important; }`}</style>
      <div ref={playerContainer} style={{ width: "100%", height: "100%" }} />
    </div>
  )
}

/**
 * 全屏播放覆盖层：先取续播位置并问云端转码决策，再按所选播放器打开。
 * 默认 movi；转码（HLS master）一律走 Artplayer；也可以交给外部播放器。
 */
const VideoPlayer = (props: {
  item: MediaItem
  // 可选：指定播放的文件路径和标题（用于选集播放）
  filePath?: string
  title?: string
  episodeIndex?: number
  onNextEpisode?: () => void
  onClose: () => void
}) => {
  const t = useT()
  const videoPath = () => props.filePath ?? mediaItemPath(props.item)
  const videoTitle = () => props.title ?? getMediaName(props.item)
  const episodeIndex = () => props.episodeIndex ?? 0

  const [choice, setChoice] = createSignal<PlayerChoice>(getPlayerChoice())
  // movi 取不到流时只在本次覆盖层内退回 Artplayer，不改存下的选择
  const [moviFailed, setMoviFailed] = createSignal(false)
  // 切换播放器时从当前位置接着放
  let lastTime = 0

  const [prep] = createResource(async () => {
    let resume = 0
    try {
      const prog = await getMediaProgress(props.item.id, episodeIndex())
      if (prog.code === 200 && prog.data && !prog.data.played) {
        resume = prog.data.position_ticks / 10_000_000
      }
    } catch {
      // 忽略进度读取失败
    }
    // 播放前先调用后端转码决策接口，如果需要转码则使用 HLS master_url 播放
    let transcode: TranscodeDecision | undefined
    try {
      const tcResp = await requestTranscodePlay(videoPath())
      if (
        tcResp.code === 200 &&
        tcResp.data?.transcode &&
        tcResp.data.master_url
      ) {
        transcode = {
          masterUrl: tcResp.data.master_url,
          jobId: tcResp.data.job_id,
          profile: tcResp.data.profile,
        }
      }
    } catch (e) {
      // 转码接口失败（可能未开启），静默降级到直链播放
      console.debug("[transcode] 转码接口不可用，使用直链播放", e)
    }
    return { resume, transcode }
  })

  const engine = () =>
    pickEngine(moviFailed() ? "artplayer" : choice(), !!prep()?.transcode)
  const resumeAt = () => (lastTime > 5 ? lastTime : (prep()?.resume ?? 0))

  // 挂到 body 并抬到外壳侧栏（z 1200）之上，但仍低于弹出菜单（hope 1400+）：
  // 否则侧栏/顶栏会盖住覆盖层的顶部栏（返回、选播放器）
  return (
    <Portal>
      <div
        style={{
          position: "fixed",
          inset: "0",
          "z-index": "1300",
          background: "#000",
          display: "flex",
          "flex-direction": "column",
        }}
      >
        {/* 顶部栏 */}
        <div
          style={{
            display: "flex",
            "align-items": "center",
            gap: "12px",
            padding: "10px 16px",
            background: "rgba(0,0,0,0.8)",
            "flex-shrink": "0",
          }}
        >
          <Button
            variant="outline"
            size="sm"
            class="gap-1.5 border-white/15 bg-white/10 text-slate-300 hover:bg-white/20 hover:text-white"
            onClick={props.onClose}
          >
            <TbArrowLeft class="size-4" />
            {t("media.video.back")}
          </Button>
          <span
            style={{
              color: "#e2e8f0",
              "font-size": "14px",
              "font-weight": "500",
            }}
          >
            {videoTitle()}
          </span>
          <div
            style={{
              "margin-left": "auto",
              display: "flex",
              "align-items": "center",
              gap: "8px",
            }}
          >
            <Show when={props.onNextEpisode}>
              <button
                id="media-next-episode"
                onClick={() => props.onNextEpisode?.()}
                style={{
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  "border-radius": "8px",
                  color: "#94a3b8",
                  padding: "6px 14px",
                  cursor: "pointer",
                  "font-size": "13px",
                }}
              >
                {t("media.video.next_episode")}
              </button>
            </Show>
            <select
              id="media-player-choice"
              aria-label={t("media.video.player_choice")}
              title={
                prep()?.transcode
                  ? t("media.video.player_transcode_note")
                  : t("media.video.player_choice")
              }
              disabled={!!prep()?.transcode}
              value={engine()}
              onChange={(e) => {
                const v = e.currentTarget.value as PlayerChoice
                setMoviFailed(false)
                setPlayerChoice(v)
                setChoice(v)
              }}
              style={{
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.12)",
                "border-radius": "8px",
                color: "#e2e8f0",
                padding: "6px 10px",
                "font-size": "13px",
              }}
            >
              <option value="movi">movi</option>
              <option value="artplayer">Artplayer</option>
            </select>
            <OpenWithPlayer
              itemId={props.item.id}
              path={props.filePath}
              name={props.title ?? props.item.file_name}
            />
          </div>
        </div>

        {/* 播放区域 */}
        <div style={{ flex: "1", position: "relative", background: "#000" }}>
          <Show when={prep()}>
            {(p) => (
              <Switch>
                <Match when={engine() === "movi"}>
                  <MediaMovi
                    itemId={props.item.id}
                    episodeIndex={episodeIndex()}
                    path={videoPath()}
                    resumeSeconds={resumeAt()}
                    onFail={() => setMoviFailed(true)}
                    onTime={(s) => (lastTime = s)}
                  />
                </Match>
                <Match when={engine() === "artplayer"}>
                  <ArtplayerView
                    item={props.item}
                    filePath={props.filePath}
                    title={props.title}
                    episodeIndex={props.episodeIndex}
                    resumeSeconds={resumeAt()}
                    transcode={p().transcode}
                    onTime={(s) => (lastTime = s)}
                  />
                </Match>
              </Switch>
            )}
          </Show>
        </div>
      </div>
    </Portal>
  )
}

// ==================== 视频详情页 ====================
// 管理员的纠正弹窗只在点开时才加载
const MediaEditorDialog = lazy(() =>
  import("~/features/media/MediaEditor").then((m) => ({
    default: m.MediaEditorDialog,
  })),
)

/** The works inside a collection, as cards; a click opens that work. */
const CollectionMembers = (props: {
  path: string | undefined
  titleColor: string
  onOpen: (id: number) => void
}) => {
  const t = useT()
  const [members] = createResource(
    () => props.path,
    async (path) => {
      const resp = await getMediaList({
        media_type: "video",
        path,
        page_size: 200,
      })
      return resp.code === 200 ? resp.data.content : []
    },
  )
  return (
    <Show when={(members() ?? []).length > 0}>
      <div style={{ "margin-bottom": "24px" }}>
        <h3
          style={{
            color: props.titleColor,
            "font-size": "13px",
            "font-weight": "600",
            "text-transform": "uppercase",
            "letter-spacing": "0.08em",
            "margin-bottom": "12px",
          }}
        >
          {t("media.video.collection_members")}
        </h3>
        <div
          style={{
            display: "grid",
            "grid-template-columns": "repeat(auto-fill, minmax(140px, 1fr))",
            gap: "12px",
          }}
        >
          <For each={members()}>
            {(m) => (
              <div
                style={{ cursor: "pointer" }}
                onClick={() => props.onOpen(m.id)}
              >
                <VideoCard item={m} />
              </div>
            )}
          </For>
        </div>
      </div>
    </Show>
  )
}

const VideoDetail = (props: {
  id: string
  onBack: () => void
  /** Opens another work from this page (the members of a collection). */
  onOpen: (id: number) => void
}) => {
  const t = useT()
  const { colorMode } = useColorMode()
  const isDark = createMemo(() => colorMode() === "dark")
  const [item, { refetch }] = createResource(
    () => parseInt(props.id),
    async (id) => {
      const resp = await getMediaItem(id)
      if (resp.code === 200) return resp.data
      return null
    },
  )

  const [showPlayer, setShowPlayer] = createSignal(false)
  const [editing, setEditing] = createSignal(false)
  // 播放中的下一集（按选集列表顺序）；最后一集或不是选集播放时没有
  const nextEpisode = () => {
    const cur = currentEpisode()
    const it = item()
    if (!cur || !it || isVersionSet(it)) return undefined
    const rows = episodeRows(it)
    const i = rows.findIndex((e) => e.file_name === cur.file_name)
    const next = i >= 0 ? rows[i + 1] : undefined
    return next ? () => setCurrentEpisode(next) : undefined
  }
  // 当前播放的选集（null 表示播放主文件）
  const [currentEpisode, setCurrentEpisode] = createSignal<EpisodeInfo | null>(
    null,
  )
  const [favorite, setFavorite] = createSignal(false)
  // 多版本电影：选中的版本序号（默认第一个）；换一部时回到第一个
  const [versionIndex, setVersionIndex] = createSignal(1)
  createEffect(
    on(
      () => item()?.id,
      () => setVersionIndex(1),
    ),
  )
  const chosenVersion = () => {
    const it = item()
    if (!it) return undefined
    const rows = versionRows(it)
    return rows.find((r) => r.index === versionIndex()) ?? rows[0]
  }
  // an episode that exists in several release folders: the one whose versions are open
  const [openEpisode, setOpenEpisode] = createSignal<EpisodeRow | null>(null)
  const versionLabelOf = (fileName: string) => {
    const it = item()
    const rows = it ? versionRows(it) : []
    const labels = versionLabels(
      rows.map((r) => r.file_name),
      t("media.video.version_original"),
    )
    const i = rows.findIndex((r) => r.file_name === fileName)
    return i >= 0 ? labels[i] : fileName
  }

  // 详情页收藏状态
  createEffect(() => {
    const it = item()
    if (!it) return
    getMediaUserData([it.id])
      .then((resp) => {
        if (resp.code !== 200 || !resp.data) return
        const row = resp.data.find((d) => d.item_id === it.id)
        setFavorite(!!row?.is_favorite)
      })
      .catch(() => {
        /* 访客场景忽略 */
      })
  })

  const toggleFavorite = async () => {
    const it = item()
    if (!it) return
    const next = !favorite()
    setFavorite(next)
    const resp = await setMediaFavorite(it.id, next)
    if (resp.code !== 200) {
      setFavorite(!next)
      notify.error(t("media.browser.favorite_failed") + ": " + resp.message)
    }
  }

  // 下载 .strm：必须带鉴权头，因此走 axios 再触发本地保存
  const downloadStrm = async (item: MediaItem) => {
    const episode = currentEpisode()?.index ?? 0
    const blob = await downloadMediaStrm(item.id, episode)
    if (!(blob instanceof Blob)) {
      notify.error(t("media.video.strm_failed"))
      return
    }
    const suffix = episode
      ? ` S${String(item.season || 1).padStart(2, "0")}E${String(episode).padStart(2, "0")}`
      : ""
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `${getMediaName(item)}${suffix}.strm`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  const titleColor = createMemo(() => (isDark() ? "#f1f5f9" : "#0f172a"))
  const metaColor = createMemo(() => (isDark() ? "#64748b" : "#94a3b8"))
  const authorColor = createMemo(() => (isDark() ? "#94a3b8" : "#475569"))
  const authorLabelColor = createMemo(() => (isDark() ? "#64748b" : "#94a3b8"))
  const plotTitleColor = createMemo(() => (isDark() ? "#94a3b8" : "#64748b"))
  const plotColor = createMemo(() => (isDark() ? "#cbd5e1" : "#334155"))
  const coverFallbackBg = createMemo(() => (isDark() ? "#1e293b" : "#e2e8f0"))
  const coverFallbackColor = createMemo(() =>
    isDark() ? "#334155" : "#94a3b8",
  )

  return (
    <Show
      when={item()}
      fallback={
        <div
          style={{
            "text-align": "center",
            padding: "60px",
            color: metaColor(),
          }}
        >
          {item.loading
            ? t("media.common.loading")
            : t("media.common.not_found")}
        </div>
      }
    >
      {(data) => {
        const authors = () => parseAuthors(data().authors)
        const genres = () => data().genre?.split(",").filter(Boolean) ?? []

        return (
          <div>
            {/* 返回按鈕 */}
            <Button
              variant="outline"
              size="sm"
              class="mb-6 gap-1.5"
              onClick={props.onBack}
            >
              <TbArrowLeft class="size-4" />
              {t("media.video.back")}
            </Button>

            <Show when={editing()}>
              <MediaEditorDialog
                path={data().path ?? ""}
                item={fromMediaItem(data())}
                onChanged={() => void refetch()}
                onClose={() => setEditing(false)}
              />
            </Show>

            {/* 背景模糊层：有剧照背景图用背景图，否则用封面 */}
            <Show when={data().backdrop_url || resolveMediaCover(data())}>
              <div
                style={{
                  position: "fixed",
                  inset: "0",
                  "background-image": `url(${data().backdrop_url || resolveMediaCover(data())})`,
                  "background-size": "cover",
                  "background-position": "center",
                  filter: "blur(40px) brightness(0.2)",
                  "z-index": "-1",
                  transform: "scale(1.1)",
                }}
              />
            </Show>

            {/* 详情内容 */}
            <div
              style={{
                display: "flex",
                gap: "32px",
                "flex-wrap": "wrap",
              }}
            >
              {/* 封面 */}
              <div style={{ "flex-shrink": "0" }}>
                <Show
                  when={resolveMediaCover(data())}
                  fallback={
                    <Show
                      when={(data().child_posters ?? []).length > 0}
                      fallback={
                        <div
                          style={{
                            width: "220px",
                            height: "330px",
                            background: coverFallbackBg(),
                            "border-radius": "12px",
                            display: "flex",
                            "align-items": "center",
                            "justify-content": "center",
                            color: coverFallbackColor(),
                          }}
                        >
                          <TbMovie class="size-16" />
                        </div>
                      }
                    >
                      <CoverMosaic
                        urls={data().child_posters ?? []}
                        width="220px"
                        height="330px"
                      />
                    </Show>
                  }
                >
                  <img
                    src={resolveMediaCover(data())}
                    alt={getMediaName(data())}
                    style={{
                      width: "220px",
                      height: "330px",
                      "object-fit": "cover",
                      "border-radius": "12px",
                      "box-shadow": "0 20px 60px rgba(0,0,0,0.5)",
                    }}
                  />
                </Show>
              </div>

              {/* 信息 */}
              <div style={{ flex: "1", "min-width": "280px" }}>
                <div
                  style={{
                    display: "flex",
                    "align-items": "flex-start",
                    gap: "12px",
                    "flex-wrap": "wrap",
                    "margin-bottom": "8px",
                  }}
                >
                  <h1
                    style={{
                      margin: "0",
                      "font-size": "28px",
                      "font-weight": "700",
                      color: titleColor(),
                      "line-height": "1.2",
                    }}
                  >
                    {getMediaName(data())}
                  </h1>
                  <Button
                    variant="outline"
                    size="sm"
                    class={cn(
                      "gap-1.5 rounded-full",
                      favorite() &&
                        "border-yellow-400/40 bg-yellow-400/15 text-yellow-400 hover:bg-yellow-400/25",
                    )}
                    aria-pressed={favorite()}
                    onClick={toggleFavorite}
                    title={
                      favorite()
                        ? t("media.detail.unfavorite")
                        : t("media.detail.favorite")
                    }
                  >
                    <Show
                      when={favorite()}
                      fallback={<TbStar class="size-4" />}
                    >
                      <TbStarFilled class="size-4" />
                    </Show>
                    {favorite()
                      ? t("media.video.favorited")
                      : t("media.video.favorite")}
                  </Button>
                </div>

                {/* 管理员：纠正入口。待确认的作品（置信度低或有候选）带一个提示 */}
                <Show when={UserMethods.is_admin(me())}>
                  <div
                    style={{
                      display: "flex",
                      "align-items": "center",
                      gap: "10px",
                      "flex-wrap": "wrap",
                      "margin-bottom": "10px",
                    }}
                  >
                    <Button
                      data-media-edit
                      variant="outline"
                      size="sm"
                      class="gap-1.5"
                      onClick={() => setEditing(true)}
                    >
                      <TbPencil class="size-4" />
                      {t("media.editor.open")}
                    </Button>
                    <Show when={isPendingMedia(data())}>
                      <span
                        data-media-pending
                        style={{
                          color: "#f59e0b",
                          "font-size": "12px",
                        }}
                      >
                        {t("media.editor.pending")}
                      </span>
                    </Show>
                    <Show when={data().locked}>
                      <span
                        class="inline-flex items-center gap-1"
                        style={{ color: metaColor(), "font-size": "12px" }}
                      >
                        <TbLock class="size-3.5" />
                        {t("media.editor.lock")}
                      </span>
                    </Show>
                  </div>
                </Show>

                {/* 原名：和显示名不同才有意义 */}
                <Show
                  when={
                    data().original_title &&
                    data().original_title !== getMediaName(data())
                  }
                >
                  <div
                    style={{
                      color: metaColor(),
                      "font-size": "14px",
                      "margin-bottom": "10px",
                    }}
                  >
                    {data().original_title}
                  </div>
                </Show>

                {/* 元信息行 */}
                <div
                  style={{
                    display: "flex",
                    "align-items": "center",
                    gap: "12px",
                    "flex-wrap": "wrap",
                    "margin-bottom": "16px",
                  }}
                >
                  {/* 多源评分；后端还没有分来源的评分时退回单个 rating */}
                  <Show
                    when={ratingBadges(data().ratings).length > 0}
                    fallback={
                      <Show when={data().rating > 0}>
                        <span
                          style={{
                            background: "rgba(251,191,36,0.15)",
                            border: "1px solid rgba(251,191,36,0.3)",
                            "border-radius": "6px",
                            padding: "3px 8px",
                            color: "#fbbf24",
                            "font-size": "14px",
                            "font-weight": "600",
                          }}
                        >
                          <TbStarFilled class="mr-1 inline size-3.5 align-[-2px]" />
                          {data().rating.toFixed(1)}
                        </span>
                      </Show>
                    }
                  >
                    <RatingBadges ratings={data().ratings} />
                  </Show>
                  <Show when={data().release_date}>
                    <span style={{ color: metaColor(), "font-size": "14px" }}>
                      {data().release_date?.slice(0, 4)}
                    </span>
                  </Show>
                  <Show when={data().video_type}>
                    <span
                      style={{
                        background: "rgba(24,144,255,0.15)",
                        border: "1px solid rgba(24,144,255,0.3)",
                        "border-radius": "6px",
                        padding: "3px 8px",
                        color: "#a5b4fc",
                        "font-size": "12px",
                      }}
                    >
                      {videoKindLabel(t, data().video_type)}
                    </span>
                  </Show>
                </div>

                {/* 类型标签 */}
                <Show when={genres().length > 0}>
                  <div
                    style={{
                      display: "flex",
                      "flex-wrap": "wrap",
                      gap: "6px",
                      "margin-bottom": "16px",
                    }}
                  >
                    <For each={genres()}>
                      {(g) => <span style={mediaChip(isDark())}>{g}</span>}
                    </For>
                  </div>
                </Show>

                {/* 演员 */}
                <Show when={authors().length > 0}>
                  <div style={{ "margin-bottom": "16px" }}>
                    <span
                      style={{ color: authorLabelColor(), "font-size": "13px" }}
                    >
                      {t("media.video.starring")}
                    </span>
                    <span style={{ color: authorColor(), "font-size": "13px" }}>
                      {authors().slice(0, 5).join(" / ")}
                    </span>
                  </div>
                </Show>

                {/* 播放器（全屏覆盖层） */}
                <Show
                  when={
                    showPlayer()
                      ? `e:${currentEpisode()?.file_name ?? ""}`
                      : undefined
                  }
                  keyed
                >
                  <VideoPlayer
                    item={data()}
                    onNextEpisode={nextEpisode()}
                    filePath={
                      currentEpisode()
                        ? `${data().folder_path?.replace(/\/$/, "")}/${data().file_name}/${currentEpisode()!.file_name}`
                        : undefined
                    }
                    title={
                      currentEpisode()
                        ? isVersionSet(data())
                          ? `${getMediaName(data())} · ${versionLabelOf(currentEpisode()!.file_name)}`
                          : currentEpisode()!.index > 0
                            ? t("media.video.episode_n_title", {
                                index: currentEpisode()!.index,
                                title: currentEpisode()!.title,
                              })
                            : currentEpisode()!.title
                        : undefined
                    }
                    episodeIndex={currentEpisode()?.index ?? 0}
                    onClose={() => setShowPlayer(false)}
                  />
                </Show>

                {/* 无选集（或是同一部电影的多个版本）：直接显示播放按钮 */}
                <Show
                  when={
                    (episodeRows(data()).length === 0 ||
                      isVersionSet(data())) &&
                    data().video_type !== "collection"
                  }
                >
                  <div
                    style={{
                      display: "flex",
                      "align-items": "center",
                      gap: "12px",
                      "flex-wrap": "wrap",
                      "margin-bottom": "24px",
                    }}
                  >
                    <Show when={isVersionSet(data())}>
                      <VersionPicker
                        rows={versionRows(data())}
                        value={chosenVersion()?.file_name}
                        onChange={(r) => setVersionIndex(r.index)}
                      />
                    </Show>
                    <MediaPlayButton
                      itemId={data().id}
                      name={data().file_name}
                      episode={
                        isVersionSet(data())
                          ? chosenVersion()?.index
                          : undefined
                      }
                      onBrowserPlay={() => {
                        setCurrentEpisode(
                          isVersionSet(data())
                            ? (chosenVersion() ?? null)
                            : null,
                        )
                        setShowPlayer(true)
                      }}
                    />
                    <Button
                      variant="outline"
                      onClick={() => {
                        if (isVersionSet(data())) {
                          setCurrentEpisode(chosenVersion() ?? null)
                        }
                        downloadStrm(data())
                      }}
                    >
                      {t("media.video.download_strm")}
                    </Button>
                  </div>
                </Show>

                {/* 选集列表（路径合并模式下有选集时显示） */}
                <Show
                  when={episodeRows(data()).length > 0 && !isVersionSet(data())}
                >
                  {(_) => {
                    const episodes = episodeRows(data())
                    return (
                      <div style={{ "margin-bottom": "24px" }}>
                        <h3
                          style={{
                            color: plotTitleColor(),
                            "font-size": "13px",
                            "font-weight": "600",
                            "text-transform": "uppercase",
                            "letter-spacing": "0.08em",
                            "margin-bottom": "12px",
                          }}
                        >
                          {t("media.video.episodes_total", {
                            n: episodes.length,
                          })}
                        </h3>
                        <div
                          style={{
                            display: "grid",
                            "grid-template-columns":
                              "repeat(auto-fill, minmax(120px, 1fr))",
                            gap: "8px",
                            "max-height": "260px",
                            "overflow-y": "auto",
                            "padding-right": "4px",
                          }}
                        >
                          <For each={episodes}>
                            {(ep) => {
                              const rowsOf = [ep, ...(ep.versions ?? [])]
                              const isActive = () =>
                                rowsOf.some(
                                  (r) =>
                                    currentEpisode()?.file_name === r.file_name,
                                )
                              const label = `${episodeText(ep, t)}${
                                ep.versions?.length
                                  ? ` · ${t("media.video.versions", { n: rowsOf.length })}`
                                  : ""
                              }`
                              return (
                                <button
                                  data-episode-versions={
                                    ep.versions?.length ? "" : undefined
                                  }
                                  onClick={() => {
                                    if (ep.versions?.length) {
                                      setOpenEpisode(
                                        openEpisode()?.file_name ===
                                          ep.file_name
                                          ? null
                                          : ep,
                                      )
                                      return
                                    }
                                    setCurrentEpisode(ep)
                                    setShowPlayer(true)
                                  }}
                                  title={
                                    ep.overview
                                      ? `${ep.file_name}\n${ep.overview}`
                                      : ep.file_name
                                  }
                                  style={{
                                    background: isActive()
                                      ? accentGradient()
                                      : isDark()
                                        ? "rgba(255,255,255,0.06)"
                                        : "rgba(0,0,0,0.05)",
                                    border: isActive()
                                      ? "none"
                                      : `1px solid ${isDark() ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
                                    "border-radius": "8px",
                                    color: isActive()
                                      ? "white"
                                      : isDark()
                                        ? "#94a3b8"
                                        : "#475569",
                                    padding: "8px 10px",
                                    "font-size": "12px",
                                    cursor: "pointer",
                                    "text-align": "left",
                                    overflow: "hidden",
                                    "text-overflow": "ellipsis",
                                    "white-space": "nowrap",
                                    transition: "all 0.15s",
                                    "box-shadow": isActive()
                                      ? "0 2px 8px rgba(24,144,255,0.4)"
                                      : "none",
                                  }}
                                >
                                  <TbPlayerPlay class="mr-1 inline size-3 align-[-1px]" />
                                  {label}
                                </button>
                              )
                            }}
                          </For>
                        </div>
                        {/* 有多个版本的那一集：选一个版本再播放 */}
                        <Show when={openEpisode()}>
                          {(ep) => (
                            <div class="mt-3 flex flex-wrap items-center gap-2">
                              <span class="text-xs text-muted-foreground">
                                {episodeText(ep(), t)}
                              </span>
                              <VersionPicker
                                rows={[ep(), ...(ep().versions ?? [])]}
                                value={currentEpisode()?.file_name}
                                onChange={(r) => {
                                  setCurrentEpisode(r)
                                  setShowPlayer(true)
                                }}
                              />
                            </div>
                          )}
                        </Show>
                        {/* 选中那一集的剧照和概述 */}
                        <Show
                          when={(() => {
                            const cur = currentEpisode() as EpisodeRow | null
                            return cur && (cur.overview || cur.still_url)
                              ? cur
                              : undefined
                          })()}
                        >
                          {(cur) => (
                            <div
                              style={{
                                display: "flex",
                                gap: "12px",
                                "margin-top": "12px",
                                "align-items": "flex-start",
                              }}
                            >
                              <Show when={cur().still_url}>
                                <img
                                  src={cur().still_url}
                                  alt=""
                                  loading="lazy"
                                  style={{
                                    width: "180px",
                                    "border-radius": "8px",
                                    "flex-shrink": "0",
                                  }}
                                />
                              </Show>
                              <p
                                style={{
                                  color: plotColor(),
                                  "font-size": "13px",
                                  "line-height": "1.6",
                                  margin: "0",
                                }}
                              >
                                {cur().overview}
                              </p>
                            </div>
                          )}
                        </Show>
                      </div>
                    )
                  }}
                </Show>

                {/* 合集：里面的作品 */}
                <Show when={data().video_type === "collection"}>
                  <CollectionMembers
                    path={data().path}
                    titleColor={plotTitleColor()}
                    onOpen={props.onOpen}
                  />
                </Show>

                {/* 剧情简介 */}
                <Show when={data().plot || data().description}>
                  <div>
                    <h3
                      style={{
                        color: plotTitleColor(),
                        "font-size": "13px",
                        "font-weight": "600",
                        "text-transform": "uppercase",
                        "letter-spacing": "0.08em",
                        "margin-bottom": "8px",
                      }}
                    >
                      {t("media.video.synopsis")}
                    </h3>
                    <p
                      style={{
                        color: plotColor(),
                        "font-size": "14px",
                        "line-height": "1.7",
                        margin: "0",
                      }}
                    >
                      {data().plot || data().description}
                    </p>
                  </div>
                </Show>
              </div>
            </div>
          </div>
        )
      }}
    </Show>
  )
}

// ==================== 视频库主页 ====================
const VideoLibrary = () => {
  const t = useT()
  const [selectedId, setSelectedId] = createSignal<string | null>(null)

  return (
    <MediaLayout title={t("media.video.title")}>
      <Show
        when={selectedId()}
        fallback={
          <MediaBrowser
            mediaType="video"
            enableFavorites
            onItemClick={(item) => setSelectedId(String(item.id))}
            renderCard={(item) => <VideoCard item={item} />}
            renderListRow={(item) => {
              const { colorMode: cm } = useColorMode()
              const dark = createMemo(() => cm() === "dark")
              return (
                <>
                  <Show
                    when={resolveMediaCover(item) || item.child_posters?.[0]}
                    fallback={
                      <TbMovie class="size-5 shrink-0 text-muted-foreground" />
                    }
                  >
                    <img
                      src={resolveMediaCover(item) || item.child_posters?.[0]}
                      style={{
                        width: "40px",
                        height: "58px",
                        "object-fit": "cover",
                        "border-radius": "4px",
                        "flex-shrink": "0",
                      }}
                    />
                  </Show>
                  <div style={{ flex: "1", "min-width": "0" }}>
                    <div
                      style={{
                        color: dark() ? "#e2e8f0" : "#1e293b",
                        "font-size": "14px",
                        overflow: "hidden",
                        "text-overflow": "ellipsis",
                        "white-space": "nowrap",
                      }}
                    >
                      {getMediaName(item)}
                    </div>
                    <div
                      style={{
                        color: dark() ? "#475569" : "#94a3b8",
                        "font-size": "12px",
                        overflow: "hidden",
                        "text-overflow": "ellipsis",
                        "white-space": "nowrap",
                      }}
                    >
                      {[
                        item.release_date?.slice(0, 4),
                        item.genre?.split(",").slice(0, 2).join("/"),
                        item.duration
                          ? t("media.video.minutes", {
                              n: Math.floor(item.duration / 60),
                            })
                          : "",
                        versionCount(item) > 0
                          ? t("media.video.versions", { n: versionCount(item) })
                          : parseEpisodes(item.episodes).length > 0
                            ? t("media.video.episodes_n", {
                                n: parseEpisodes(item.episodes).length,
                              })
                            : formatMediaSize(item.file_size),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                    <Show when={parseAuthors(item.authors).length > 0}>
                      <div
                        style={{
                          color: dark() ? "#334155" : "#94a3b8",
                          "font-size": "11px",
                          overflow: "hidden",
                          "text-overflow": "ellipsis",
                          "white-space": "nowrap",
                        }}
                      >
                        {t("media.video.cast")}
                        {parseAuthors(item.authors).slice(0, 4).join(" / ")}
                      </div>
                    </Show>
                  </div>
                  <Show when={item.rating > 0}>
                    <span
                      style={{
                        color: "#fbbf24",
                        "font-size": "13px",
                        "flex-shrink": "0",
                      }}
                    >
                      <TbStarFilled class="mr-1 inline size-3.5 align-[-2px]" />
                      {item.rating.toFixed(1)}
                    </span>
                  </Show>
                </>
              )
            }}
          />
        }
      >
        <VideoDetail
          id={selectedId()!}
          onBack={() => setSelectedId(null)}
          onOpen={(id) => setSelectedId(String(id))}
        />
      </Show>
    </MediaLayout>
  )
}

export default VideoLibrary
