import { resolveMediaCover } from "~/utils/media_cover"
import { accentGradient } from "~/utils/accent"
import {
  createSignal,
  createResource,
  createMemo,
  Show,
  For,
  createEffect,
} from "solid-js"
import {
  TbArrowDown,
  TbArrowLeft,
  TbArrowsSort,
  TbArrowUp,
  TbChevronLeft,
  TbChevronRight,
  TbFolder,
  TbFolders,
  TbLayoutGrid,
  TbLayoutList,
  TbLoader2,
  TbMusic,
  TbPlayerPlayFilled,
  TbSearch,
  TbStarFilled,
} from "solid-icons/tb"
import { Dynamic } from "solid-js/web"
import { MediaLayout } from "../MediaLayout"
import { MediaItemDetail } from "../MediaItemDetail"
import {
  getAlbumList,
  getAlbumTracks,
  getMediaFolders,
  getMediaList,
  getMediaUserData,
  setMediaFavorite,
} from "~/utils/media_api"
import type { MediaItem, AlbumInfo } from "~/types"
import { getMediaName, formatDuration } from "~/types"
import { notify } from "~/utils"
import { useT } from "~/hooks"
import { playPlaylist, playTrack } from "./player"

type BrowseMode = "all" | "folder"
type OrderBy = "name" | "date" | "size"
type OrderDir = "asc" | "desc"

export {
  MusicPlayer,
  closePlayer,
  initAudio,
  playNext,
  playPlaylist,
  playPrev,
  playTrack,
  playerState,
  setPlayerState,
  togglePlay,
} from "./player"
import { Button } from "~/components/ui/button"
import { ChipTabs } from "~/components/ui/chip-tabs"
import { DataState } from "~/components/ui/data-state"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { Input } from "~/components/ui/input"
import { Skeleton } from "~/components/ui/skeleton"
import { SortMenuItems } from "~/components/ui/sort-menu"
import { cn } from "~/utils/cn"

// ==================== 专辑卡片 ====================
const AlbumCard = (props: { album: AlbumInfo }) => {
  const t = useT()
  return (
    <div class="overflow-hidden rounded-xl border bg-card transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-lg">
      <div class="relative bg-muted pt-[100%]">
        <Show
          when={props.album.cover}
          fallback={
            <div class="absolute inset-0 flex items-center justify-center text-muted-foreground">
              <TbMusic class="size-12" />
            </div>
          }
        >
          <img
            src={resolveMediaCover(props.album)}
            alt={props.album.album_name}
            class="absolute inset-0 size-full object-cover"
            loading="lazy"
          />
        </Show>
      </div>
      <div class="px-3 py-2.5">
        <div class="truncate text-[13px] font-medium">
          {props.album.album_name || t("media.music.unknown_album")}
        </div>
        <div class="mt-0.5 truncate text-[11px] text-muted-foreground">
          {[
            props.album.album_artist || t("media.music.unknown_artist"),
            props.album.release_date?.slice(0, 4),
            t("media.music.track_count", { count: props.album.track_count }),
          ]
            .filter(Boolean)
            .join(" / ")}
        </div>
      </div>
    </div>
  )
}

const WallSkeleton = () => (
  <div
    data-state="loading"
    aria-busy="true"
    class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6"
  >
    <For each={Array.from({ length: 12 })}>
      {() => <Skeleton class="aspect-square rounded-xl" />}
    </For>
  </div>
)

// ==================== 专辑详情 ====================
const AlbumDetail = (props: { album: AlbumInfo; onBack: () => void }) => {
  const t = useT()
  // 用 createMemo 稳定化 source，避免每次渲染都产生新对象引用导致无限重复请求
  const trackSource = createMemo(
    () => `${props.album.album_name}|||${props.album.album_artist}`,
  )

  const [tracks] = createResource(trackSource, async (key) => {
    const [name, artist] = key.split("|||")
    // 专辑名和艺术家名都为空时才跳过（后端要求至少一个不为空）
    if (!name && !artist) return [] as MediaItem[]
    const resp = await getAlbumTracks(name, artist)
    if (resp.code === 200) return resp.data as MediaItem[]
    return [] as MediaItem[]
  })

  return (
    <div>
      <Button
        variant="outline"
        size="sm"
        class="mb-6 gap-1.5"
        onClick={props.onBack}
      >
        <TbArrowLeft class="size-4" />
        {t("media.music.back")}
      </Button>

      {/* 专辑头部 */}
      <div class="mb-8 flex flex-wrap gap-7">
        <Show
          when={props.album.cover}
          fallback={
            <div
              class="flex size-[180px] shrink-0 items-center justify-center rounded-xl text-white"
              style={{ background: accentGradient() }}
            >
              <TbMusic class="size-16 opacity-85" />
            </div>
          }
        >
          <img
            src={resolveMediaCover(props.album)}
            alt={props.album.album_name}
            class="size-[180px] shrink-0 rounded-xl object-cover shadow-xl"
          />
        </Show>
        <div class="min-w-0 flex-1">
          <div class="mb-1.5 text-xs text-muted-foreground">
            {t("media.music.album")}
          </div>
          <h2 class="m-0 mb-2 text-2xl font-semibold">
            {props.album.album_name || t("media.music.unknown_album")}
          </h2>
          <div class="mb-1 text-sm text-muted-foreground">
            {props.album.album_artist}
          </div>
          <div class="mb-4 text-[13px] text-muted-foreground">
            {props.album.release_date?.slice(0, 4)} ·{" "}
            {t("media.music.song_count", { count: props.album.track_count })}
          </div>
          <Button
            class="gap-2"
            onClick={() => {
              const list = tracks()
              if (list && list.length > 0) playPlaylist(list, 0)
            }}
          >
            <TbPlayerPlayFilled class="size-4" />
            {t("media.music.play_all")}
          </Button>
        </div>
      </div>

      {/* 曲目列表 */}
      <div>
        <h3 class="mb-3 text-sm font-semibold">
          {t("media.music.track_list")}
        </h3>
        <Show
          when={!tracks.loading}
          fallback={<Skeleton class="h-24 w-full" />}
        >
          <Show
            when={(tracks()?.length ?? 0) > 0}
            fallback={
              <DataState empty emptyText={t("media.music.no_tracks")}>
                {null}
              </DataState>
            }
          >
            <For each={tracks() ?? []}>
              {(track, i) => (
                <div
                  onClick={() => {
                    const list = tracks()
                    if (list && list.length > 0) playPlaylist(list, i())
                  }}
                  class="flex cursor-pointer items-center gap-3 rounded-lg border-b px-3 py-2.5 transition-colors hover:bg-accent"
                >
                  <span class="w-6 text-right text-[13px] text-muted-foreground">
                    {track.track_number || i() + 1}
                  </span>
                  <div class="min-w-0 flex-1 truncate text-sm">
                    {getMediaName(track)}
                  </div>
                  <span class="text-xs text-muted-foreground">
                    {formatDuration(track.duration)}
                  </span>
                </div>
              )}
            </For>
          </Show>
        </Show>
      </div>
    </div>
  )
}

// ==================== 音乐库主页 ====================
const MusicLibrary = () => {
  const t = useT()
  const [selectedAlbum, setSelectedAlbum] = createSignal<AlbumInfo | null>(null)
  // 卡片（专辑）/ 列表（歌曲）视图，持久化到浏览器
  const MUSIC_VIEW_KEY = "media-view-mode-music"
  const storedMusicView = (() => {
    try {
      const v = localStorage.getItem(MUSIC_VIEW_KEY)
      return v === "list" || v === "card" ? v : "card"
    } catch {
      return "card"
    }
  })()
  const [viewMode, setViewMode] = createSignal<"card" | "list">(storedMusicView)
  const changeViewMode = (mode: "card" | "list") => {
    setViewMode(mode)
    try {
      localStorage.setItem(MUSIC_VIEW_KEY, mode)
    } catch {
      /* ignore */
    }
  }
  const [selectedTrack, setSelectedTrack] = createSignal<MediaItem | null>(null)
  const [favorites, setFavorites] = createSignal<Record<number, boolean>>({})
  const [page, setPage] = createSignal(1)
  const [keyword, setKeyword] = createSignal("")
  const [browseMode, setBrowseMode] = createSignal<BrowseMode>("all")
  const [orderBy, setOrderBy] = createSignal<OrderBy>("name")
  const [orderDir, setOrderDir] = createSignal<OrderDir>("asc")
  const [selectedFolder, setSelectedFolder] = createSignal("")
  const pageSize = 40

  const [albumData] = createResource(
    () => ({
      page: page(),
      page_size: pageSize,
      keyword: keyword() || undefined,
      order_by: orderBy(),
      order_dir: orderDir(),
      folder_path: browseMode() === "folder" ? selectedFolder() : undefined,
    }),
    async (params) => {
      const resp = await getAlbumList(params)
      if (resp.code === 200) return resp.data
      return { content: [], total: 0 }
    },
  )

  // 加载文件夹列表
  const [foldersData] = createResource(
    () => (browseMode() === "folder" ? "music" : null),
    async (mt) => {
      if (!mt) return []
      const resp = await getMediaFolders("music")
      if (resp.code === 200) return resp.data
      return []
    },
  )

  // 列表视图：直接拉取歌曲条目，展示专辑 / 作者 / 类型 / 年代
  const [trackData] = createResource(
    () =>
      viewMode() === "list"
        ? {
            page: page(),
            page_size: pageSize,
            keyword: keyword() || undefined,
            order_by: orderBy(),
            order_dir: orderDir(),
            folder_path:
              browseMode() === "folder" ? selectedFolder() : undefined,
          }
        : null,
    async (params) => {
      if (!params) return { content: [], total: 0 }
      const resp = await getMediaList({ media_type: "music", ...params })
      if (resp.code === 200) return resp.data
      return { content: [], total: 0 }
    },
  )

  const albums = () => (albumData()?.content as AlbumInfo[]) ?? []
  const tracks = () => (trackData()?.content as MediaItem[]) ?? []
  const total = () =>
    (viewMode() === "list" ? trackData()?.total : albumData()?.total) ?? 0
  const totalPages = () => Math.ceil(total() / pageSize)

  // 批量拉取收藏状态
  createEffect(() => {
    const list = tracks()
    const ids = list.map((item) => item.id)
    if (ids.length === 0) {
      setFavorites({})
      return
    }
    getMediaUserData(ids)
      .then((resp) => {
        if (resp.code !== 200 || !resp.data) return
        const map: Record<number, boolean> = {}
        resp.data.forEach((row) => {
          map[row.item_id] = row.is_favorite
        })
        setFavorites(map)
      })
      .catch(() => {
        /* 忽略访客场景 */
      })
  })

  // 列表视图保持有选中项
  createEffect(() => {
    const list = tracks()
    const current = selectedTrack()
    if (viewMode() !== "list" || list.length === 0) {
      if (current && !list.some((item) => item.id === current.id)) {
        setSelectedTrack(null)
      }
      return
    }
    if (!current || !list.some((item) => item.id === current.id)) {
      setSelectedTrack(list[0])
    }
  })

  const toggleFavorite = async (item: MediaItem, favorite: boolean) => {
    setFavorites((prev) => ({ ...prev, [item.id]: favorite }))
    const resp = await setMediaFavorite(item.id, favorite)
    if (resp.code !== 200) {
      setFavorites((prev) => ({ ...prev, [item.id]: !favorite }))
      notify.error(t("media.browser.favorite_failed") + ": " + resp.message)
    }
  }

  const changeOrder = (key: string | undefined, reverse: boolean) => {
    const col = (key ?? orderBy()) as OrderBy
    if (col !== orderBy()) {
      setOrderBy(col)
      setOrderDir("asc")
    } else {
      setOrderDir(reverse ? "desc" : "asc")
    }
    setPage(1)
  }

  return (
    <MediaLayout title={t("media.music.title")}>
      <Show
        when={selectedAlbum()}
        fallback={
          <div>
            {/* 工具栏 */}
            <div class="mb-4 flex flex-wrap items-center gap-2">
              <ChipTabs
                label="browse"
                items={[
                  { key: "all" as BrowseMode, label: t("media.browser.all") },
                  {
                    key: "folder" as BrowseMode,
                    label: t("media.browser.folders"),
                  },
                ]}
                value={browseMode()}
                onChange={(mode) => {
                  setBrowseMode(mode)
                  setPage(1)
                }}
              />

              <DropdownMenu placement="bottom-start">
                <DropdownMenuTrigger
                  as={Button}
                  variant="outline"
                  size="sm"
                  data-media-sort
                  aria-label={t("media.browser.sort")}
                >
                  <TbArrowsSort class="mr-1.5 size-4" />
                  {t(`media.browser.${orderBy()}`)}
                  <Dynamic
                    component={orderDir() === "asc" ? TbArrowUp : TbArrowDown}
                    class="ml-1 size-3.5"
                  />
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <SortMenuItems
                    options={(["name", "date", "size"] as OrderBy[]).map(
                      (k) => ({ key: k, label: t(`media.browser.${k}`) }),
                    )}
                    value={orderBy()}
                    reverse={orderDir() === "desc"}
                    labels={{
                      by: t("media.browser.sort_by"),
                      asc: t("media.browser.asc"),
                      desc: t("media.browser.desc"),
                    }}
                    onChange={changeOrder}
                  />
                </DropdownMenuContent>
              </DropdownMenu>

              <div class="flex-1" />

              {/* 搜索 */}
              <div class="relative">
                <TbSearch class="pointer-events-none absolute left-2.5 top-2 size-4 text-muted-foreground" />
                <Input
                  type="search"
                  class="h-8 w-52 pl-8 text-xs"
                  placeholder={t("media.music.search_placeholder")}
                  aria-label={t("media.music.search_placeholder")}
                  value={keyword()}
                  onInput={(e) => {
                    setKeyword(e.currentTarget.value)
                    setPage(1)
                  }}
                />
              </div>

              {/* 视图切换 */}
              <div class="flex gap-1">
                <For
                  each={
                    [
                      ["card", TbLayoutGrid, "media.music.view_card"],
                      ["list", TbLayoutList, "media.music.view_list"],
                    ] as const
                  }
                >
                  {([mode, icon, label]) => (
                    <Button
                      variant={viewMode() === mode ? "secondary" : "ghost"}
                      class="size-8 p-0"
                      title={t(label)}
                      aria-label={t(label)}
                      aria-pressed={viewMode() === mode}
                      onClick={() => {
                        changeViewMode(mode)
                        setPage(1)
                      }}
                    >
                      <Dynamic component={icon} class="size-4" />
                    </Button>
                  )}
                </For>
              </div>
            </div>

            {/* 目录浏览模式 */}
            <Show when={browseMode() === "folder"}>
              <div class="mb-4">
                <ChipTabs
                  label="folders"
                  items={[
                    {
                      key: "",
                      label: t("media.browser.all_folders"),
                      icon: <TbFolders class="size-4" />,
                    },
                    ...((foldersData() ?? []) as string[]).map((folder) => ({
                      key: folder,
                      label: folder.split("/").pop() || folder,
                      title: folder,
                      icon: <TbFolder class="size-4" />,
                    })),
                  ]}
                  value={selectedFolder()}
                  onChange={(folder) => {
                    setSelectedFolder(folder)
                    setPage(1)
                  }}
                />
              </div>
            </Show>

            {/* 卡片视图：专辑 */}
            <Show when={viewMode() === "card"}>
              <Show when={!albumData.loading} fallback={<WallSkeleton />}>
                <Show
                  when={albums().length > 0}
                  fallback={
                    <DataState empty emptyText={t("media.music.no_albums")}>
                      {null}
                    </DataState>
                  }
                >
                  <div style={{ columns: "5 150px", "column-gap": "16px" }}>
                    <For each={albums()}>
                      {(album) => (
                        <div
                          class="mb-4 cursor-pointer [break-inside:avoid]"
                          onClick={() => setSelectedAlbum(album)}
                        >
                          <AlbumCard album={album} />
                        </div>
                      )}
                    </For>
                  </div>
                </Show>
              </Show>
            </Show>

            {/* 列表视图：歌曲 + 右侧详情 */}
            <Show when={viewMode() === "list"}>
              <Show when={!trackData.loading} fallback={<WallSkeleton />}>
                <Show
                  when={tracks().length > 0}
                  fallback={
                    <DataState empty emptyText={t("media.music.no_albums")}>
                      {null}
                    </DataState>
                  }
                >
                  <div class="grid grid-cols-1 items-start gap-4 min-[1100px]:grid-cols-[minmax(0,1fr)_320px]">
                    <div class="flex flex-col gap-1">
                      <For each={tracks()}>
                        {(track) => (
                          <div
                            onClick={() => setSelectedTrack(track)}
                            onDblClick={() => playTrack(track)}
                            title={t("media.music.track_item_tip")}
                            class={cn(
                              "flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 transition-colors",
                              selectedTrack()?.id === track.id
                                ? "border-primary/50 bg-primary/10"
                                : "bg-card hover:bg-accent",
                            )}
                          >
                            <Show
                              when={track.cover}
                              fallback={
                                <div
                                  class="flex size-10 shrink-0 items-center justify-center rounded-md text-white"
                                  style={{ background: accentGradient() }}
                                >
                                  <TbMusic class="size-[18px]" />
                                </div>
                              }
                            >
                              <img
                                src={resolveMediaCover(track)}
                                alt={getMediaName(track)}
                                loading="lazy"
                                class="size-10 shrink-0 rounded-md object-cover"
                              />
                            </Show>
                            <div class="min-w-0 flex-1">
                              <div class="truncate text-sm">
                                {getMediaName(track)}
                              </div>
                              <div class="truncate text-xs text-muted-foreground">
                                {[track.album_name, track.album_artist]
                                  .filter(Boolean)
                                  .join(" · ") ||
                                  t("media.music.unknown_album")}
                              </div>
                            </div>
                            <div class="shrink-0 text-right text-xs text-muted-foreground">
                              <div>
                                {[track.genre, track.release_date?.slice(0, 4)]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </div>
                              <div>{formatDuration(track.duration)}</div>
                            </div>
                            <Show when={favorites()[track.id]}>
                              <TbStarFilled class="size-3.5 shrink-0 text-yellow-400" />
                            </Show>
                          </div>
                        )}
                      </For>
                    </div>
                    <Show when={selectedTrack()}>
                      {(track) => (
                        <div class="hidden min-[1100px]:block">
                          <MediaItemDetail
                            item={track()}
                            favorite={!!favorites()[track().id]}
                            onToggleFavorite={toggleFavorite}
                            onOpen={(item) => playTrack(item)}
                            openLabel={t("media.music.play")}
                          />
                        </div>
                      )}
                    </Show>
                  </div>
                </Show>
              </Show>
            </Show>

            {/* 分页 */}
            <Show when={totalPages() > 1}>
              <div class="mt-8 flex flex-wrap items-center justify-center gap-2 text-sm text-muted-foreground">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page() <= 1}
                  onClick={() => setPage(page() - 1)}
                >
                  <TbChevronLeft class="mr-1 size-4" />
                  {t("media.browser.prev_page")}
                </Button>
                <span>
                  {t("media.browser.page_info", {
                    page: page(),
                    totalPages: totalPages(),
                    total: total(),
                  })}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page() >= totalPages()}
                  onClick={() => setPage(page() + 1)}
                >
                  {t("media.browser.next_page")}
                  <TbChevronRight class="ml-1 size-4" />
                </Button>
              </div>
            </Show>
          </div>
        }
      >
        <AlbumDetail
          album={selectedAlbum()!}
          onBack={() => setSelectedAlbum(null)}
        />
      </Show>
    </MediaLayout>
  )
}

export default MusicLibrary
