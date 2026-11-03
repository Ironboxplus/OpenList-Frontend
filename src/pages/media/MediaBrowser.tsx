import {
  createSignal,
  createResource,
  createEffect,
  createMemo,
  For,
  Show,
  Switch,
  Match,
} from "solid-js"
import { useSearchParams } from "@solidjs/router"
import {
  getMediaFavorites,
  getMediaList,
  getMediaFolders,
  getMediaScanPaths,
  getMediaUserData,
  setMediaFavorite,
} from "~/utils/media_api"
import { notify } from "~/utils"
import { useT } from "~/hooks"
import type { MediaItem, MediaType, MediaScanPath } from "~/types"
import { mediaTitle } from "~/types"
import { Button } from "~/components/ui/button"
import { ChipTabs } from "~/components/ui/chip-tabs"
import { DataState } from "~/components/ui/data-state"
import { focusRing } from "~/components/ui/focus"
import { Input } from "~/components/ui/input"
import { SimpleSelect } from "~/components/ui/simple-select"
import { Skeleton } from "~/components/ui/skeleton"
import { cn } from "~/utils/cn"
import { Dynamic } from "solid-js/web"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { SortMenuItems } from "~/components/ui/sort-menu"
import {
  TbArrowDown,
  TbArrowsSort,
  TbArrowUp,
  TbChevronLeft,
  TbChevronRight,
  TbChevronsLeft,
  TbChevronsRight,
  TbFolder,
  TbFolders,
  TbLayoutGrid,
  TbLayoutList,
  TbMovie,
  TbSearch,
  TbStar,
  TbStarFilled,
} from "solid-icons/tb"
import { MediaItemDetail } from "./MediaItemDetail"

interface MediaBrowserProps {
  mediaType: MediaType
  onItemClick: (item: MediaItem) => void
  onItemsChange?: (items: MediaItem[]) => void
  renderCard: (item: MediaItem) => any
  renderListRow?: (item: MediaItem) => any
  /** 是否显示收藏入口（星标 / 收藏 Tab） */
  enableFavorites?: boolean
}

type ViewMode = "waterfall" | "list"
type BrowseMode = "all" | "folder" | "favorites"
// "recent" is the backend's default order (creation time): no order_by is sent.
type OrderBy = "name" | "date" | "recent" | "size"
type OrderDir = "asc" | "desc"

export const MediaBrowser = (props: MediaBrowserProps) => {
  const t = useT()
  // URL 查询参数（持久化页码、便于浏览器前进/后退恢复浏览状态）
  const [searchParams, setSearchParams] = useSearchParams<{ page?: string }>()

  // 视图模式按媒体类型持久化，切回页面时保持上次选择
  const viewStorageKey = `media-view-mode-${props.mediaType}`
  const storedView = (() => {
    try {
      const v = localStorage.getItem(viewStorageKey)
      return v === "list" || v === "waterfall" ? v : "waterfall"
    } catch {
      return "waterfall"
    }
  })()
  const [viewMode, setViewMode] = createSignal<ViewMode>(storedView)
  const changeViewMode = (mode: ViewMode) => {
    setViewMode(mode)
    try {
      localStorage.setItem(viewStorageKey, mode)
    } catch {
      /* ignore */
    }
  }
  // 列表视图右侧详情面板
  const [selected, setSelected] = createSignal<MediaItem | null>(null)
  const [favorites, setFavorites] = createSignal<Record<number, boolean>>({})
  const [browseMode, setBrowseMode] = createSignal<BrowseMode>("all")
  const [orderBy, setOrderBy] = createSignal<OrderBy>("name")
  const [orderDir, setOrderDir] = createSignal<OrderDir>("asc")
  // 初始化时从 URL 中读取 page，便于从详情页返回时恢复
  const initialPage = (() => {
    const p = parseInt(searchParams.page ?? "1", 10)
    return Number.isFinite(p) && p > 0 ? p : 1
  })()
  const [page, setPageRaw] = createSignal(initialPage)
  const [keyword, setKeyword] = createSignal("")
  const [selectedFolder, setSelectedFolder] = createSignal("")
  const [selectedScanPathId, setSelectedScanPathId] = createSignal<number>(0)
  const [selectedTypeTag, setSelectedTypeTag] = createSignal("")
  const [selectedContentTag, setSelectedContentTag] = createSignal("")
  // 页码跳转输入框中的值
  const [pageInput, setPageInput] = createSignal(String(initialPage))

  // 包装 setPage：同步到 URL
  const setPage = (p: number) => {
    setPageRaw(p)
    setPageInput(String(p))
    // 写入 URL（page=1 时移除参数让 URL 更干净）
    setSearchParams(
      { page: p === 1 ? undefined : String(p) },
      { replace: false, scroll: false },
    )
  }

  // 监听 URL 变化（浏览器前进/后退时同步内部 state）
  createEffect(() => {
    const p = parseInt(searchParams.page ?? "1", 10)
    const valid = Number.isFinite(p) && p > 0 ? p : 1
    if (valid !== page()) {
      setPageRaw(valid)
      setPageInput(String(valid))
    }
  })

  const pageSize = 40

  // 加载扫描路径列表（用于筛选）
  const [scanPathsData] = createResource(
    () => props.mediaType,
    async (mt) => {
      const resp = await getMediaScanPaths(mt)
      if (resp.code === 200) return resp.data as MediaScanPath[]
      return [] as MediaScanPath[]
    },
  )

  // 计算所有可用的类型标签和内容标签
  const allTypeTags = createMemo(() => {
    const paths = scanPathsData() ?? []
    const tags = new Set<string>()
    paths.forEach((p) => {
      if (p.type_tag) tags.add(p.type_tag)
    })
    return Array.from(tags)
  })

  const allContentTags = createMemo(() => {
    const paths = scanPathsData() ?? []
    const tags = new Set<string>()
    paths.forEach((p) => {
      if (p.content_tags)
        p.content_tags.split(",").forEach((t) => {
          if (t.trim()) tags.add(t.trim())
        })
    })
    return Array.from(tags)
  })

  const apiOrder = () => {
    const o = orderBy()
    return o === "recent" ? undefined : o
  }

  // 加载媒体列表（收藏 Tab 走收藏接口）
  const [mediaData, { refetch: refetchMedia }] = createResource(
    () => ({
      favorites: browseMode() === "favorites",
      media_type: props.mediaType,
      page: page(),
      page_size: pageSize,
      order_by: apiOrder(),
      order_dir: orderDir(),
      folder_path: browseMode() === "folder" ? selectedFolder() : undefined,
      keyword: keyword() || undefined,
      scan_path_id: selectedScanPathId() || undefined,
      type_tag: selectedTypeTag() || undefined,
      content_tag: selectedContentTag() || undefined,
    }),
    async (params) => {
      if (params.favorites) {
        const resp = await getMediaFavorites(
          props.mediaType,
          params.page,
          params.page_size,
        )
        if (resp.code === 200) return resp.data
        return { content: [], total: 0 }
      }
      const { favorites: _favorites, ...query } = params
      const resp = await getMediaList(query)
      if (resp.code === 200) return resp.data
      return { content: [], total: 0 }
    },
  )

  // 加载文件夹列表
  const [foldersData] = createResource(
    () => (browseMode() === "folder" ? props.mediaType : null),
    async (mt) => {
      if (!mt) return []
      const resp = await getMediaFolders(mt)
      if (resp.code === 200) return resp.data
      return []
    },
  )

  const items = () => (mediaData()?.content as MediaItem[]) ?? []
  const total = () => mediaData()?.total ?? 0
  const totalPages = () => Math.ceil(total() / pageSize)

  // 数据变化时通知父组件（空列表也要通知，否则父组件会保留上一页的陈旧数据）
  createEffect(() => {
    if (mediaData.loading) return
    props.onItemsChange?.(items())
  })

  // 批量拉取当前页条目的收藏状态
  createEffect(() => {
    const list = items()
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
        /* 访客或未登录时忽略 */
      })
  })

  // 列表视图下保持有选中项，并跟随分页 / 筛选更新
  createEffect(() => {
    const list = items()
    const current = selected()
    if (viewMode() !== "list" || list.length === 0) {
      if (current && !list.some((item) => item.id === current.id)) {
        setSelected(null)
      }
      return
    }
    if (!current || !list.some((item) => item.id === current.id)) {
      setSelected(list[0])
    }
  })

  const toggleFavorite = async (item: MediaItem, favorite: boolean) => {
    // 乐观更新，失败时回滚
    setFavorites((prev) => ({ ...prev, [item.id]: favorite }))
    const resp = await setMediaFavorite(item.id, favorite)
    if (resp.code !== 200) {
      setFavorites((prev) => ({ ...prev, [item.id]: !favorite }))
      notify.error(t("media.browser.favorite_failed") + ": " + resp.message)
      return
    }
    // 在收藏 Tab 取消收藏后，立即从当前列表移除
    if (!favorite && browseMode() === "favorites") {
      refetchMedia()
    }
  }

  const sortOptions = createMemo(() =>
    (["name", "date", "recent", "size"] as OrderBy[]).map((k) => ({
      key: k,
      label: t(`media.browser.${k}`),
    })),
  )
  const changeOrder = (key: string | undefined, reverse: boolean) => {
    const col = (key ?? orderBy()) as OrderBy
    if (col !== orderBy()) {
      // a new key starts in its natural direction: newest first for "recent"
      setOrderBy(col)
      setOrderDir(col === "recent" ? "desc" : "asc")
    } else {
      setOrderDir(reverse ? "desc" : "asc")
    }
    setPage(1)
  }

  const browseItems = createMemo(() => [
    { key: "all" as BrowseMode, label: t("media.browser.all") },
    { key: "folder" as BrowseMode, label: t("media.browser.folders") },
    ...(props.enableFavorites
      ? [
          {
            key: "favorites" as BrowseMode,
            label: t("media.browser.favorites"),
          },
        ]
      : []),
  ])
  const folderItems = createMemo(() => [
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
  ])
  const ALL = "__all"
  const pathOptions = createMemo(() => [
    { value: ALL, label: t("media.browser.all_paths") },
    ...(scanPathsData() ?? []).map((sp) => ({
      value: String(sp.id),
      label: sp.name || sp.path,
    })),
  ])
  const tagOptions = (tags: string[], all: string) => [
    { value: ALL, label: all },
    ...tags.map((tag) => ({ value: tag, label: tag })),
  ]

  /** The star on a card or row: a Tabler star, filled when favourited. */
  const FavoriteButton = (p: { item: MediaItem; overlay?: boolean }) => {
    const on = () => !!favorites()[p.item.id]
    const label = () =>
      on() ? t("media.detail.unfavorite") : t("media.detail.favorite")
    return (
      <button
        type="button"
        title={label()}
        aria-label={label()}
        data-favorite-toggle
        onClick={(e) => {
          e.stopPropagation()
          toggleFavorite(p.item, !on())
        }}
        class={cn(
          focusRing,
          "flex size-8 shrink-0 items-center justify-center rounded-full",
          p.overlay
            ? "absolute right-2 top-2 z-[2] border border-white/25 bg-black/45 text-slate-100"
            : "bg-transparent text-muted-foreground hover:bg-accent",
          on() && "text-yellow-400",
        )}
      >
        <Show when={on()} fallback={<TbStar class="size-4" />}>
          <TbStarFilled class="size-4" />
        </Show>
      </button>
    )
  }

  const jump = () => {
    const n = parseInt(pageInput(), 10)
    if (Number.isFinite(n) && n >= 1 && n <= totalPages()) {
      setPage(n)
    } else {
      setPageInput(String(page()))
    }
  }

  return (
    <div class="w-full min-w-0">
      {/* 工具栏 */}
      <div class="mb-4 flex flex-wrap items-center gap-2">
        <ChipTabs
          label="browse"
          items={browseItems()}
          value={browseMode()}
          onChange={(mode) => {
            setBrowseMode(mode)
            setPage(1)
            setSelected(null)
          }}
        />

        <Show when={(scanPathsData() ?? []).length > 0}>
          <SimpleSelect
            class="h-8 w-auto gap-2 text-xs"
            aria-label={t("media.browser.all_paths")}
            options={pathOptions()}
            value={selectedScanPathId() ? String(selectedScanPathId()) : ALL}
            onChange={(v) => {
              setSelectedScanPathId(v === ALL ? 0 : Number(v))
              setPage(1)
            }}
          />
        </Show>
        <Show when={allTypeTags().length > 0}>
          <SimpleSelect
            class="h-8 w-auto gap-2 text-xs"
            aria-label={t("media.browser.all_types")}
            options={tagOptions(allTypeTags(), t("media.browser.all_types"))}
            value={selectedTypeTag() || ALL}
            onChange={(v) => {
              setSelectedTypeTag(v === ALL ? "" : v)
              setPage(1)
            }}
          />
        </Show>
        <Show when={allContentTags().length > 0}>
          <SimpleSelect
            class="h-8 w-auto gap-2 text-xs"
            aria-label={t("media.browser.all_tags")}
            options={tagOptions(allContentTags(), t("media.browser.all_tags"))}
            value={selectedContentTag() || ALL}
            onChange={(v) => {
              setSelectedContentTag(v === ALL ? "" : v)
              setPage(1)
            }}
          />
        </Show>

        {/* 排序 */}
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
              options={sortOptions()}
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
            class="h-8 w-44 pl-8 text-xs"
            placeholder={t("media.browser.search_placeholder")}
            aria-label={t("media.browser.search_placeholder")}
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
                ["waterfall", TbLayoutGrid, "media.browser.waterfall"],
                ["list", TbLayoutList, "media.browser.list"],
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
                onClick={() => changeViewMode(mode)}
              >
                <Dynamic component={icon} class="size-4" />
              </Button>
            )}
          </For>
        </div>
      </div>

      {/* 目录浏览模式 - 文件夹列表 */}
      <Show when={browseMode() === "folder"}>
        <div class="mb-4">
          <ChipTabs
            label="folders"
            items={folderItems()}
            value={selectedFolder()}
            onChange={(folder) => {
              setSelectedFolder(folder)
              setPage(1)
            }}
          />
        </div>
      </Show>

      {/* 内容区域 */}
      <Show
        when={!mediaData.loading}
        fallback={
          <div
            data-state="loading"
            aria-busy="true"
            class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6"
          >
            <For each={Array.from({ length: 12 })}>
              {() => <Skeleton class="aspect-[2/3] rounded-xl" />}
            </For>
          </div>
        }
      >
        <Show
          when={items().length > 0}
          fallback={
            <DataState empty emptyText={t("media.browser.empty")}>
              {null}
            </DataState>
          }
        >
          <Switch>
            {/* 瀑布流视图 */}
            <Match when={viewMode() === "waterfall"}>
              <div style={{ columns: "5 150px", "column-gap": "16px" }}>
                <For each={items()}>
                  {(item) => (
                    <div
                      class="relative mb-4 cursor-pointer [break-inside:avoid]"
                      onClick={() => props.onItemClick(item)}
                    >
                      {props.renderCard(item)}
                      <Show when={props.enableFavorites}>
                        <FavoriteButton item={item} overlay />
                      </Show>
                    </div>
                  )}
                </For>
              </div>
            </Match>

            {/* 列表视图：左侧列表 + 右侧详情 */}
            <Match when={viewMode() === "list"}>
              <div class="grid grid-cols-1 items-start gap-4 min-[1100px]:grid-cols-[minmax(0,1fr)_320px]">
                <div class="flex flex-col gap-1">
                  <For each={items()}>
                    {(item) => (
                      <div
                        onClick={() => setSelected(item)}
                        onDblClick={() => props.onItemClick(item)}
                        title={t("media.browser.list_item_tip")}
                        class={cn(
                          "flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-2.5 transition-colors",
                          selected()?.id === item.id
                            ? "border-primary/50 bg-primary/10"
                            : "bg-card hover:bg-accent",
                        )}
                      >
                        {props.renderListRow ? (
                          props.renderListRow(item)
                        ) : (
                          <>
                            <TbMovie class="size-5 shrink-0 text-muted-foreground" />
                            <span class="text-sm">{mediaTitle(item)}</span>
                          </>
                        )}
                        <Show when={props.enableFavorites}>
                          <FavoriteButton item={item} />
                        </Show>
                      </div>
                    )}
                  </For>
                </div>
                <Show when={selected()}>
                  {(item) => (
                    <div class="hidden min-[1100px]:block">
                      <MediaItemDetail
                        item={item()}
                        favorite={!!favorites()[item().id]}
                        onToggleFavorite={toggleFavorite}
                        onOpen={props.onItemClick}
                      />
                    </div>
                  )}
                </Show>
              </div>
            </Match>
          </Switch>
        </Show>
      </Show>

      {/* 分页 */}
      <Show when={totalPages() > 1}>
        <div class="mt-8 flex flex-wrap items-center justify-center gap-2 text-sm text-muted-foreground">
          <Button
            variant="outline"
            size="sm"
            disabled={page() <= 1}
            onClick={() => setPage(1)}
          >
            <TbChevronsLeft class="mr-1 size-4" />
            {t("media.browser.first_page")}
          </Button>
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
          <Button
            variant="outline"
            size="sm"
            disabled={page() >= totalPages()}
            onClick={() => setPage(totalPages())}
          >
            {t("media.browser.last_page")}
            <TbChevronsRight class="ml-1 size-4" />
          </Button>
          <span>{t("media.browser.jump_to")}</span>
          <Input
            type="number"
            min="1"
            max={totalPages()}
            class="h-8 w-16 px-2 text-center text-xs"
            aria-label={t("media.browser.jump_to")}
            value={pageInput()}
            onInput={(e) => setPageInput(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") jump()
            }}
            onBlur={() => {
              const n = parseInt(pageInput(), 10)
              if (!Number.isFinite(n) || n < 1 || n > totalPages()) {
                setPageInput(String(page()))
              }
            }}
          />
          <Button variant="outline" size="sm" onClick={jump}>
            {t("media.browser.jump")}
          </Button>
        </div>
      </Show>
    </div>
  )
}
