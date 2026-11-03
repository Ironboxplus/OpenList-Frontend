import { For, Show, createMemo } from "solid-js"
import { Dynamic } from "solid-js/web"
import { Button } from "~/components/ui/button"
import { focusRing } from "~/components/ui/focus"
import { cn } from "~/utils/cn"
import {
  TbStar,
  TbStarFilled,
  TbArrowUpRight,
  TbPhoto,
  TbMovie,
  TbBook,
  TbMusic,
} from "solid-icons/tb"
import { useT } from "~/hooks"
import { resolveMediaCover } from "~/utils/media_cover"
import { accentGradient } from "~/utils/accent"
import { ratingBadges } from "~/features/media/logic"
import {
  formatDuration,
  getMediaName,
  parseAuthors,
  type MediaItem,
} from "~/types"

interface MediaItemDetailProps {
  item: MediaItem
  favorite?: boolean
  onToggleFavorite?: (item: MediaItem, favorite: boolean) => void
  onOpen?: (item: MediaItem) => void
  openLabel?: string
}

const formatSize = (bytes: number) => {
  if (!bytes) return ""
  const units = ["B", "KB", "MB", "GB", "TB"]
  let value = bytes
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i++
  }
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

/**
 * 列表视图右侧的详细信息面板。
 * 按媒体类型展示刮削字段，并支持收藏 / 取消收藏。
 */
export const MediaItemDetail = (props: MediaItemDetailProps) => {
  const t = useT()
  /** 每个评分来源一段（豆瓣 8.7 / IMDb 7.9）；后端没有分来源时退回单个评分 */
  const videoRatingText = () => {
    const item = props.item
    const parts = ratingBadges(item.ratings).map(
      (b) => `${t(`media.rating.${b.key}`)} ${b.text}`,
    )
    if (parts.length > 0) return parts.join(" / ")
    return item.rating > 0 ? item.rating.toFixed(1) : ""
  }

  const rows = createMemo<[string, string][]>(() => {
    const item = props.item
    const list: [string, string][] = []
    const year = (item.release_date || "").slice(0, 4)
    const push = (label: string, value?: string | number) => {
      if (value === undefined || value === null || value === "") return
      list.push([label, String(value)])
    }
    const cast = parseAuthors(item.authors)

    switch (item.media_type) {
      case "video":
        push(t("media.detail.release"), year)
        push(
          t("media.detail.genre"),
          item.genre?.split(",").filter(Boolean).join(" / "),
        )
        push(t("media.detail.rating"), videoRatingText())
        push(t("media.detail.cast"), cast.slice(0, 8).join(" / "))
        push(
          t("media.detail.season_episode"),
          item.season || item.episode
            ? `S${item.season || 1}E${item.episode || 1}`
            : "",
        )
        push(
          t("media.detail.duration"),
          item.duration ? formatDuration(item.duration) : "",
        )
        break
      case "music":
        push(t("media.detail.album"), item.album_name)
        push(t("media.detail.artist"), item.album_artist || cast.join(" / "))
        push(t("media.detail.genre"), item.genre)
        push(t("media.detail.year"), year)
        push(
          t("media.detail.track"),
          item.track_number
            ? t("media.detail.track_no", { index: item.track_number })
            : "",
        )
        push(
          t("media.detail.duration"),
          item.duration ? formatDuration(item.duration) : "",
        )
        break
      case "book":
        push(t("media.detail.author"), cast.join(" / "))
        push(t("media.detail.publisher"), item.publisher)
        push("ISBN", item.isbn)
        push(t("media.detail.genre"), item.genre)
        push(t("media.detail.publish_year"), year)
        push(
          t("media.detail.rating"),
          item.rating > 0 ? item.rating.toFixed(1) : "",
        )
        break
      case "image":
        push(t("media.detail.location"), cast.join(" / "))
        push(t("media.detail.genre"), item.genre)
        push(t("media.detail.shoot_date"), year)
        break
    }
    push(t("media.detail.size"), formatSize(item.file_size))
    return list
  })

  const description = createMemo(
    () => props.item.plot || props.item.description || props.item.reviews || "",
  )

  const typeIcon = () => {
    switch (props.item.media_type) {
      case "video":
        return TbMovie
      case "music":
        return TbMusic
      case "book":
        return TbBook
      default:
        return TbPhoto
    }
  }

  return (
    <div class="sticky top-4 max-h-[calc(100vh-140px)] overflow-auto rounded-xl border bg-card p-4 text-card-foreground">
      {/* 封面 */}
      <div
        class={cn(
          "relative mb-3.5 max-h-[300px] w-full overflow-hidden rounded-[10px] bg-muted",
          props.item.media_type === "music" ? "aspect-square" : "aspect-[2/3]",
        )}
      >
        <Show
          when={props.item.cover}
          fallback={
            <div
              class="flex size-full items-center justify-center text-white"
              style={{ background: accentGradient() }}
            >
              <Dynamic component={typeIcon()} class="size-11 opacity-85" />
            </div>
          }
        >
          <img
            src={resolveMediaCover(props.item)}
            alt={getMediaName(props.item)}
            class="size-full object-cover"
          />
        </Show>
        <Show when={props.onToggleFavorite}>
          <button
            type="button"
            title={
              props.favorite
                ? t("media.detail.unfavorite")
                : t("media.detail.favorite")
            }
            aria-label={
              props.favorite
                ? t("media.detail.unfavorite")
                : t("media.detail.favorite")
            }
            onClick={(e) => {
              e.stopPropagation()
              props.onToggleFavorite?.(props.item, !props.favorite)
            }}
            class={cn(
              focusRing,
              "absolute right-2 top-2 flex size-8 items-center justify-center rounded-full border border-white/25 bg-black/45 text-slate-100 backdrop-blur-sm",
              props.favorite && "text-yellow-400",
            )}
          >
            <Show when={props.favorite} fallback={<TbStar class="size-4" />}>
              <TbStarFilled class="size-4" />
            </Show>
          </button>
        </Show>
      </div>

      {/* 标题 */}
      <div class="mb-1 break-words text-base font-semibold leading-snug">
        {getMediaName(props.item)}
      </div>
      <div class="mb-3 break-all text-xs text-muted-foreground">
        {props.item.file_name}
      </div>

      {/* 字段 */}
      <div class="flex flex-col gap-2">
        <For each={rows()}>
          {([label, value]) => (
            <div class="grid grid-cols-[64px_minmax(0,1fr)] gap-2.5 text-xs leading-normal">
              <span class="text-muted-foreground">{label}</span>
              <span class="break-words">{value}</span>
            </div>
          )}
        </For>
      </div>

      {/* 简介 */}
      <Show when={description()}>
        <div class="mt-3.5 border-t pt-3">
          <div class="mb-1.5 text-xs text-muted-foreground">
            {t("media.detail.description")}
          </div>
          <div class="line-clamp-[8] whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
            {description()}
          </div>
        </div>
      </Show>

      {/* 打开 */}
      <Show when={props.onOpen}>
        <Button
          class="mt-4 w-full gap-1.5 text-white"
          style={{ background: accentGradient() }}
          onClick={() => props.onOpen?.(props.item)}
        >
          <TbArrowUpRight class="size-4" />
          {props.openLabel || t("media.detail.open")}
        </Button>
      </Show>
    </div>
  )
}
