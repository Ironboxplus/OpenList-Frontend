import { Dynamic } from "solid-js/web"
import {
  TbAlertTriangle,
  TbBook,
  TbChevronLeft,
  TbChevronRight,
  TbChevronsLeft,
  TbChevronsRight,
  TbDots,
  TbMovie,
  TbMusic,
  TbPhoto,
  TbPlus,
} from "solid-icons/tb"
import { Alert, AlertDescription } from "~/components/ui/alert"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card } from "~/components/ui/card"
import { ChipTabs } from "~/components/ui/chip-tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { Input, Textarea } from "~/components/ui/input"
import { SimpleSelect } from "~/components/ui/simple-select"
import {
  Switch,
  SwitchControl,
  SwitchLabel,
  SwitchThumb,
} from "~/components/ui/switch"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip"
import { Field } from "./Field"
import { ConfirmDialog } from "~/features/settings/form/ConfirmDialog"
import {
  ResourceList,
  type ResourceColumn,
  type RowAction,
} from "~/features/settings/form/ResourceList"
import {
  For,
  Show,
  createEffect,
  createMemo,
  createResource,
  createSignal,
  onCleanup,
} from "solid-js"
import type {
  MediaConfig,
  MediaItem,
  MediaScanPath,
  MediaScanProgress,
  MediaType,
  Storage,
} from "~/types"
import { notify, r } from "~/utils"
import { useT } from "~/hooks"
import {
  adminClearMediaDB,
  adminClearMediaScanPathDB,
  adminClearMediaScrape,
  adminCreateMediaScanPath,
  adminDeleteInvalidMedia,
  adminDeleteMediaItem,
  adminDeleteMediaScanPath,
  adminExportMediaDB,
  adminGenerateStrm,
  adminGetMediaConfigs,
  adminGetMediaItems,
  adminGetMediaScanProgress,
  adminImportMediaDB,
  adminListMediaScanPaths,
  adminSaveMediaConfig,
  adminStartMediaScan,
  adminStartMediaScrape,
  adminUpdateMediaItem,
  adminUpdateMediaScanPath,
} from "~/utils/media_api"
import { ThumbnailSettings } from "./ThumbnailSettings"
import { resolveMediaCover } from "~/utils/media_cover"

interface MediaManagePageProps {
  mediaType: MediaType
  title: string
}

interface ConfirmState {
  title: string
  message: string
  confirmText?: string
  danger?: boolean
  onConfirm: () => void | Promise<void>
}

type TabKey = "paths" | "items" | "settings"

/**
 * 每种媒体类型一个页面：基础配置 / 扫描路径 / 媒体管理（/ 设置）四个 Tab。
 * 扫描路径严格按 props.mediaType 隔离，接口调用与字段与改造前完全一致。
 */
export const MediaManagePage = (props: MediaManagePageProps) => {
  const t = useT()
  const [tab, setTab] = createSignal<TabKey>("paths")

  // 确认弹窗（替代自写 ConfirmDialog）
  const [confirmState, setConfirmState] = createSignal<ConfirmState | null>(
    null,
  )
  const [confirming, setConfirming] = createSignal(false)
  const showConfirm = (opts: ConfirmState) => setConfirmState(opts)
  const runConfirm = async () => {
    const opts = confirmState()
    if (!opts) return
    setConfirming(true)
    try {
      await opts.onConfirm()
    } finally {
      setConfirming(false)
      setConfirmState(null)
    }
  }

  // 配置
  const [config, setConfig] = createSignal<MediaConfig>({
    media_type: props.mediaType,
    enabled: false,
    last_scan_at: null,
    last_scrape_at: null,
  })
  const [configSaving, setConfigSaving] = createSignal(false)

  // 扫描路径
  const [scanPaths, setScanPaths] = createSignal<MediaScanPath[]>([])
  const [showScanPathModal, setShowScanPathModal] = createSignal(false)
  const [editingScanPath, setEditingScanPath] =
    createSignal<Partial<MediaScanPath> | null>(null)
  const [scanPathSaving, setScanPathSaving] = createSignal(false)

  // 扫描 / 刮削
  const [scanning, setScanning] = createSignal(false)
  const [scraping, setScraping] = createSignal(false)
  const [progress, setProgress] = createSignal<{
    status: string
    current: number
    total: number
  } | null>(null)

  // 条目管理
  const [page, setPage] = createSignal(1)
  const [pageSize, setPageSize] = createSignal(
    props.mediaType === "image" ? 25 : 10,
  )
  const [filterScanPathId, setFilterScanPathId] = createSignal<number>(0)
  const [filterKeyword, setFilterKeyword] = createSignal("")
  const [searchInput, setSearchInput] = createSignal("")
  const [editingItem, setEditingItem] = createSignal<MediaItem | null>(null)
  const [showEditModal, setShowEditModal] = createSignal(false)

  // 搜索防抖
  let searchTimer: ReturnType<typeof setTimeout> | undefined
  // 扫描进度轮询定时器：必须在组件 Owner 作用域内创建，否则 onCleanup 不会生效
  let scanTimer: ReturnType<typeof setInterval> | undefined
  const stopScanPolling = () => {
    if (scanTimer) {
      clearInterval(scanTimer)
      scanTimer = undefined
    }
  }
  const handleSearchInput = (value: string) => {
    setSearchInput(value)
    if (searchTimer) clearTimeout(searchTimer)
    searchTimer = setTimeout(() => {
      setFilterKeyword(value)
      setPage(1)
    }, 500)
  }
  onCleanup(() => {
    if (searchTimer) clearTimeout(searchTimer)
    stopScanPolling()
  })

  // 加载配置
  const [configData] = createResource(
    () => props.mediaType,
    async (mt) => {
      const resp = await adminGetMediaConfigs()
      if (resp.code === 200) {
        const found = (resp.data as MediaConfig[]).find(
          (c) => c.media_type === mt,
        )
        if (found) setConfig(found)
      }
      return null
    },
  )

  // 加载扫描路径（仅当前媒体类型）
  const loadScanPaths = async () => {
    const resp = await adminListMediaScanPaths(props.mediaType)
    if (resp.code === 200) setScanPaths(resp.data as MediaScanPath[])
  }
  createEffect(() => {
    if (props.mediaType) loadScanPaths()
  })

  // 加载媒体条目
  const [itemsData, { refetch: refetchItems }] = createResource(
    () => ({
      media_type: props.mediaType,
      page: page(),
      page_size: pageSize(),
      scan_path_id: filterScanPathId() || undefined,
      keyword: filterKeyword() || undefined,
    }),
    async (params) => {
      const resp = await adminGetMediaItems(params)
      if (resp.code === 200) return resp.data
      return { content: [], total: 0 }
    },
  )

  const items = () => (itemsData()?.content as MediaItem[]) ?? []
  const total = () => itemsData()?.total ?? 0
  const totalPages = () => Math.max(1, Math.ceil(total() / pageSize()))

  // 检查签名相关配置：媒体播放依赖直链，开启签名会导致无法播放
  const checkSigningConflict = async (): Promise<string[]> => {
    const conflicts: string[] = []
    try {
      const resp: any = await r.get("/admin/setting/list?group=4")
      const items: { key: string; value: string }[] = resp?.data ?? []
      if (items.find((i) => i.key === "sign_all")?.value === "true") {
        conflicts.push(t("media.admin.conflict_sign_all"))
      }
    } catch {
      // 检测失败不影响保存流程
    }
    try {
      const resp: any = await r.get("/admin/storage/list")
      const list = (resp?.data?.content ?? []) as (Storage & {
        enable_sign?: boolean
      })[]
      if (list.some((s) => s.enable_sign && !s.disabled)) {
        conflicts.push(t("media.admin.conflict_storage_sign"))
      }
    } catch {
      // 检测失败不影响保存流程
    }
    return conflicts
  }

  // 保存配置
  const handleSaveConfig = async () => {
    setConfigSaving(true)
    const resp = await adminSaveMediaConfig(config())
    setConfigSaving(false)
    if (resp.code !== 200) {
      notify.error(t("media.admin.save_failed") + ": " + resp.message)
      return
    }
    notify.success(t("media.admin.config_saved"))
    if (config().enabled) {
      const conflicts = await checkSigningConflict()
      if (conflicts.length > 0) {
        notify.warning(
          t("media.admin.signing_conflict", {
            title: props.title,
            conflicts: conflicts.join(", "),
          }),
        )
      }
    }
  }

  // ============== 扫描路径操作 ==============
  const handleOpenCreateScanPath = () => {
    setEditingScanPath({
      media_type: props.mediaType,
      name: "",
      path: "/",
      path_merge: false,
      type_tag: "",
      content_tags: "",
      enable_scrape: true,
    })
    setShowScanPathModal(true)
  }

  const handleOpenEditScanPath = (sp: MediaScanPath) => {
    setEditingScanPath({ ...sp })
    setShowScanPathModal(true)
  }

  const handleSaveScanPath = async () => {
    const sp = editingScanPath()
    if (!sp) return
    setScanPathSaving(true)
    const resp = sp.id
      ? await adminUpdateMediaScanPath(sp as MediaScanPath & { id: number })
      : await adminCreateMediaScanPath(sp)
    setScanPathSaving(false)
    if (resp.code === 200) {
      notify.success(
        sp.id
          ? t("media.admin.scan_path_updated")
          : t("media.admin.scan_path_created"),
      )
      setShowScanPathModal(false)
      setEditingScanPath(null)
      await loadScanPaths()
    } else {
      notify.error(t("media.admin.op_failed") + ": " + resp.message)
    }
  }

  const handleDeleteScanPath = (sp: MediaScanPath) => {
    showConfirm({
      title: t("media.admin.delete_scan_path"),
      message: t("media.admin.delete_scan_path_msg", {
        name: sp.name || sp.path,
      }),
      confirmText: t("global.delete"),
      danger: true,
      onConfirm: async () => {
        const resp = await adminDeleteMediaScanPath(sp.id!)
        if (resp.code === 200) {
          notify.success(t("media.admin.scan_path_deleted"))
          await loadScanPaths()
        } else {
          notify.error(t("media.admin.delete_failed") + ": " + resp.message)
        }
      },
    })
  }

  const handleClearScanPathDB = (sp: MediaScanPath) => {
    showConfirm({
      title: t("media.admin.clear_path_title"),
      message: t("media.admin.clear_path_msg", { name: sp.name || sp.path }),
      confirmText: t("media.admin.clear"),
      danger: true,
      onConfirm: async () => {
        const resp = await adminClearMediaScanPathDB(sp.id!)
        if (resp.code === 200) {
          notify.success(t("media.admin.path_cleared"))
          refetchItems()
        } else {
          notify.error(t("media.admin.clear_failed") + ": " + resp.message)
        }
      },
    })
  }

  // ============== 扫描 ==============
  const pollScanProgress = () => {
    // 先停掉旧的轮询，避免重复点击叠出多个定时器
    stopScanPolling()
    // 注意：项目的 axios 拦截器对网络错误 / 非 2xx 不会 reject，而是返回 { code, message }，
    // 所以失败计数必须按 code 判断（只看 catch 会永远为 0）：
    // 登录过期后 code 为 401，否则会每秒静默空转直到离开页面。
    let failures = 0
    scanTimer = setInterval(async () => {
      let code = -1
      let message = ""
      let data: MediaScanProgress | null = null
      try {
        const resp = await adminGetMediaScanProgress(props.mediaType)
        code = resp.code
        message = resp.message
        data = resp.data
      } catch (e: any) {
        message = e?.message ?? String(e)
      }
      if (code !== 200 || !data) {
        failures += 1
        if (failures >= 5 || code === 401 || code === 403) {
          stopScanPolling()
          setScanning(false)
          notify.error(
            t("media.admin.progress_failed") +
              ": " +
              (message || `HTTP ${code}`),
          )
        }
        return
      }
      failures = 0
      setProgress({
        status:
          data.message ||
          (data.running ? t("media.admin.scanning") : t("media.admin.done")),
        current: data.done,
        total: data.total,
      })
      if (!data.running) {
        stopScanPolling()
        setScanning(false)
        refetchItems()
        notify.success(t("media.admin.scan_done"))
      }
    }, 1000)
  }

  /** 启动扫描：失败（如 403 未授权/未启用）时必须复位 scanning，否则按钮永久转圈 */
  const startScan = async (scanPathId?: number) => {
    if (!config().enabled) {
      notify.warning(t("media.admin.enable_first"))
      return
    }
    setScanning(true)
    setProgress({ status: t("media.admin.scanning"), current: 0, total: 0 })
    try {
      const resp = await adminStartMediaScan(props.mediaType, scanPathId)
      if (resp.code !== 200) {
        setScanning(false)
        setProgress(null)
        notify.error(
          t("media.admin.scan_start_failed") +
            ": " +
            (resp.message || `HTTP ${resp.code}`),
        )
        return
      }
      pollScanProgress()
    } catch (e: any) {
      setScanning(false)
      setProgress(null)
      notify.error(
        t("media.admin.scan_start_failed") + ": " + (e?.message ?? String(e)),
      )
    }
  }

  const handleScanPath = (sp: MediaScanPath) => startScan(sp.id)

  const handleScanAll = () => startScan()

  const handleScrape = async () => {
    setScraping(true)
    const resp = await adminStartMediaScrape(props.mediaType)
    setScraping(false)
    if (resp.code === 200) {
      notify.info(t("media.admin.scrape_started"))
      refetchItems()
    } else {
      notify.error(t("media.admin.scrape_failed") + ": " + resp.message)
    }
  }

  const handleClearAll = () => {
    showConfirm({
      title: t("media.admin.clear_all_title", { title: props.title }),
      message: t("media.admin.clear_all_msg", { title: props.title }),
      confirmText: t("media.admin.clear_all"),
      danger: true,
      onConfirm: async () => {
        const resp = await adminClearMediaDB(props.mediaType)
        if (resp.code === 200) {
          notify.success(t("media.admin.db_cleared"))
          refetchItems()
        } else {
          notify.error(t("media.admin.clear_failed") + ": " + resp.message)
        }
      },
    })
  }

  const handleClearScrape = () => {
    showConfirm({
      title: t("media.admin.clear_scrape_title", { title: props.title }),
      message: t("media.admin.clear_scrape_msg", { title: props.title }),
      confirmText: t("media.admin.clear_scrape"),
      onConfirm: async () => {
        const resp = await adminClearMediaScrape(props.mediaType)
        if (resp.code === 200) {
          const affected = resp.data?.affected ?? 0
          notify.success(t("media.admin.clear_scrape_ok", { count: affected }))
          refetchItems()
        } else {
          notify.error(
            t("media.admin.clear_scrape_failed") + ": " + resp.message,
          )
        }
      },
    })
  }

  const handleDeleteInvalid = () => {
    showConfirm({
      title: t("media.admin.delete_invalid_title", { title: props.title }),
      message: t("media.admin.delete_invalid_msg", { title: props.title }),
      confirmText: t("media.admin.delete_invalid"),
      danger: true,
      onConfirm: async () => {
        notify.info(t("media.admin.checking_invalid"))
        const resp = await adminDeleteInvalidMedia(props.mediaType)
        if (resp.code === 200) {
          const checked = resp.data?.checked ?? 0
          const deleted = resp.data?.deleted ?? 0
          const skipped = resp.data?.skipped ?? 0
          notify.success(
            t("media.admin.delete_invalid_ok", { checked, deleted }) +
              (skipped > 0
                ? t("media.admin.delete_invalid_skipped", { count: skipped })
                : ""),
          )
          refetchItems()
        } else {
          notify.error(t("media.admin.delete_failed") + ": " + resp.message)
        }
      },
    })
  }

  // ============== 导入 / 导出 ==============
  const triggerDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleBlobExport = async (blob: Blob, filename: string) => {
    if (!blob || !(blob instanceof Blob)) {
      notify.error(t("media.admin.export_no_stream"))
      return
    }
    if (blob.size < 1024) {
      try {
        const txt = await blob.text()
        const obj = JSON.parse(txt)
        if (obj && typeof obj.code === "number" && obj.code !== 200) {
          notify.error(
            t("media.admin.export_failed") +
              ": " +
              (obj.message || t("media.admin.unknown_error")),
          )
          return
        }
      } catch {
        // 不是 JSON 错误体，按文件下载继续
      }
    }
    triggerDownload(blob, filename)
    notify.success(t("media.admin.export_ok"))
  }

  const handleExportAll = async () => {
    try {
      const blob = await adminExportMediaDB(props.mediaType)
      const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)
      await handleBlobExport(blob, `media_export_${props.mediaType}_${ts}.json`)
    } catch (e: any) {
      notify.error(t("media.admin.export_failed") + ": " + (e?.message || e))
    }
  }

  const handleExportScanPath = async (sp: MediaScanPath) => {
    try {
      const blob = await adminExportMediaDB(props.mediaType, sp.id!)
      const safeName = (sp.name || sp.path || `path_${sp.id}`).replace(
        /[\\/:*?"<>|]/g,
        "_",
      )
      const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)
      await handleBlobExport(
        blob,
        `media_export_${props.mediaType}_${safeName}_${ts}.json`,
      )
    } catch (e: any) {
      notify.error(t("media.admin.export_failed") + ": " + (e?.message || e))
    }
  }

  const pickJsonFile = (): Promise<File | null> =>
    new Promise((resolve) => {
      const input = document.createElement("input")
      input.type = "file"
      input.accept = "application/json,.json"
      input.onchange = () => {
        resolve(input.files && input.files[0] ? input.files[0] : null)
      }
      input.click()
    })

  const handleImportAll = async () => {
    const file = await pickJsonFile()
    if (!file) return
    showConfirm({
      title: t("media.admin.import_title", { title: props.title }),
      message: t("media.admin.import_msg", { file: file.name }),
      confirmText: t("media.admin.import"),
      onConfirm: async () => {
        const resp = await adminImportMediaDB(file)
        if (resp.code === 200) {
          const d = resp.data
          notify.success(
            t("media.admin.import_ok", {
              created: d.scan_paths_created,
              updated: d.scan_paths_updated,
              items_created: d.items_created,
              items_updated: d.items_updated,
            }),
          )
          await loadScanPaths()
          refetchItems()
        } else {
          notify.error(t("media.admin.import_failed") + ": " + resp.message)
        }
      },
    })
  }

  const handleImportScanPath = async (sp: MediaScanPath) => {
    const file = await pickJsonFile()
    if (!file) return
    showConfirm({
      title: t("media.admin.import_path_title", {
        name: sp.name || sp.path,
      }),
      message: t("media.admin.import_path_msg", { file: file.name }),
      confirmText: t("media.admin.import"),
      onConfirm: async () => {
        const resp = await adminImportMediaDB(file, sp.id!)
        if (resp.code === 200) {
          const d = resp.data
          notify.success(
            t("media.admin.import_path_ok", {
              created: d.items_created,
              updated: d.items_updated,
            }),
          )
          refetchItems()
        } else {
          notify.error(t("media.admin.import_failed") + ": " + resp.message)
        }
      },
    })
  }

  const handleGenerateStrm = async () => {
    const resp = await adminGenerateStrm(props.mediaType)
    if (resp.code === 200) {
      notify.success(
        t("media.admin.strm_ok", {
          count: resp.data.written,
          path: resp.data.path,
        }),
      )
    } else {
      notify.error(t("media.admin.strm_failed") + ": " + resp.message)
    }
  }

  // ============== 条目操作 ==============
  const handleSaveItem = async () => {
    if (!editingItem()) return
    const resp = await adminUpdateMediaItem(editingItem()!)
    if (resp.code === 200) {
      notify.success(t("media.admin.save_ok"))
      setShowEditModal(false)
      setEditingItem(null)
      refetchItems()
    } else {
      notify.error(t("media.admin.save_failed") + ": " + resp.message)
    }
  }

  const handleDeleteItem = (id: number, name: string) => {
    showConfirm({
      title: t("media.admin.delete_item_title"),
      message: t("media.admin.delete_item_msg", { name }),
      confirmText: t("global.delete"),
      danger: true,
      onConfirm: async () => {
        const resp = await adminDeleteMediaItem(id)
        if (resp.code === 200) {
          notify.success(t("media.admin.deleted"))
          refetchItems()
        } else {
          notify.error(t("media.admin.delete_failed") + ": " + resp.message)
        }
      },
    })
  }

  const getScanPathName = (id: number) =>
    scanPaths().find((p) => p.id === id)?.name ||
    scanPaths().find((p) => p.id === id)?.path ||
    "-"

  const coverIcon = () =>
    ({ video: TbMovie, music: TbMusic, image: TbPhoto, book: TbBook })[
      props.mediaType
    ]

  const supportsThumbnailSettings = () =>
    props.mediaType === "image" || props.mediaType === "book"

  // 页签列表（图片 / 书籍额外提供缩略图设置）
  const tabItems = createMemo(() => {
    const list: { key: TabKey; label: string }[] = [
      { key: "paths", label: t("media.admin.tab_paths") },
      { key: "items", label: t("media.admin.tab_items") },
    ]
    if (supportsThumbnailSettings()) {
      list.push({ key: "settings", label: t("media.admin.tab_settings") })
    }
    return list
  })

  const pathActions = (sp: MediaScanPath): RowAction<MediaScanPath>[] => [
    {
      id: "scan",
      label: t("media.admin.scan"),
      onSelect: handleScanPath,
      disabled: scanning(),
    },
    {
      id: "export",
      label: t("media.admin.export"),
      onSelect: handleExportScanPath,
    },
    {
      id: "import",
      label: t("media.admin.import"),
      onSelect: handleImportScanPath,
    },
    {
      id: "clear",
      label: t("media.admin.clear"),
      destructive: true,
      onSelect: handleClearScanPathDB,
    },
    {
      id: "delete",
      label: t("global.delete"),
      destructive: true,
      onSelect: handleDeleteScanPath,
    },
  ]

  const yesNo = (on: boolean | undefined) => (
    <Badge variant={on ? "success" : "outline"}>
      {on ? t("media.admin.yes") : t("media.admin.no")}
    </Badge>
  )

  const pathColumns = (): ResourceColumn<MediaScanPath>[] => [
    {
      id: "name",
      header: t("media.admin.col_path_name"),
      cell: (sp) => sp.name || "-",
      class: "font-medium",
    },
    {
      id: "path",
      header: t("media.admin.col_scan_path"),
      cell: (sp) => <span class="font-mono text-xs">{sp.path}</span>,
    },
    {
      id: "type_tag",
      header: t("media.admin.col_type_tags"),
      cell: (sp) => (
        <Show when={sp.type_tag}>
          <Badge variant="info">{sp.type_tag}</Badge>
        </Show>
      ),
    },
    {
      id: "content_tags",
      header: t("media.admin.col_content_tags"),
      cell: (sp) => (
        <div class="flex flex-wrap gap-1">
          <For each={(sp.content_tags || "").split(",").filter(Boolean)}>
            {(tag) => <Badge variant="secondary">{tag.trim()}</Badge>}
          </For>
        </div>
      ),
    },
    {
      id: "path_merge",
      header: t("media.admin.col_path_merge"),
      cell: (sp) => yesNo(sp.path_merge),
    },
    {
      id: "scrape",
      header: t("media.admin.col_scrape"),
      cell: (sp) => yesNo(sp.enable_scrape),
    },
    {
      id: "last_scan",
      header: t("media.admin.col_last_scan"),
      class: "whitespace-nowrap text-xs text-muted-foreground",
      cell: (sp) =>
        sp.last_scan_at
          ? new Date(sp.last_scan_at).toLocaleString(undefined, {
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })
          : t("media.admin.never"),
    },
  ]

  const itemActions = (item: MediaItem): RowAction<MediaItem>[] => [
    {
      id: "delete",
      label: t("global.delete"),
      destructive: true,
      onSelect: () =>
        handleDeleteItem(item.id, item.scraped_name || item.file_name),
    },
  ]

  const itemColumns = (): ResourceColumn<MediaItem>[] => [
    {
      id: "file_name",
      header: t("media.admin.col_file_name"),
      class: "max-w-[200px]",
      cell: (item) => (
        <span
          title={item.file_name}
          class="block truncate text-xs text-muted-foreground"
        >
          {item.file_name}
        </span>
      ),
    },
    {
      id: "name",
      header: t("media.admin.col_name"),
      class: "max-w-[180px]",
      cell: (item) => (
        <span class="block truncate font-medium">
          {item.scraped_name || item.file_name}
        </span>
      ),
    },
    {
      id: "cover",
      header: t("media.admin.col_cover"),
      cell: (item) => (
        <Show
          when={item.cover}
          fallback={
            <div class="flex h-16 w-12 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <Dynamic component={coverIcon()} class="size-5" />
            </div>
          }
        >
          <img
            src={resolveMediaCover(item)}
            loading="lazy"
            alt={item.scraped_name || item.file_name}
            class="h-16 w-12 rounded-md border bg-muted object-cover"
          />
        </Show>
      ),
    },
    {
      id: "scan_path",
      header: t("media.admin.col_scan_path"),
      class: "text-xs text-muted-foreground",
      cell: (item) => getScanPathName(item.scan_path_id),
    },
    {
      id: "release_date",
      header: t("media.admin.col_release_date"),
      class: "whitespace-nowrap text-xs text-muted-foreground",
      cell: (item) => item.release_date?.slice(0, 10) || "-",
    },
    {
      id: "rating",
      header: t("media.admin.col_rating"),
      class: "text-xs text-muted-foreground",
      cell: (item) => (item.rating > 0 ? item.rating.toFixed(1) : "-"),
    },
    {
      id: "hidden",
      header: t("media.admin.col_hidden"),
      cell: (item) => (
        <Switch
          checked={item.hidden}
          onChange={async (on) => {
            await adminUpdateMediaItem({ ...item, hidden: on })
            refetchItems()
          }}
        >
          <SwitchControl aria-label={t("media.admin.col_hidden")}>
            <SwitchThumb />
          </SwitchControl>
        </Switch>
      ),
    },
  ]

  const perPageOptions = () =>
    (props.mediaType === "image" ? [15, 25, 50, 75, 100] : [5, 10, 20]).map(
      (n) => ({ value: String(n), label: String(n) }),
    )

  return (
    <div class="flex w-full flex-col gap-4">
      {/* The crumb is the page title; this keeps the heading for assistive tech. */}
      <h1 class="sr-only">{props.title}</h1>

      {/* 工具栏：页签 + 操作按钮 + 当前类型开关（原「基础配置」合并到这里） */}
      <Card class="flex flex-col gap-3 p-3">
        <div class="flex flex-wrap items-center gap-2">
          <ChipTabs
            label="tabs"
            items={tabItems()}
            value={tab()}
            onChange={setTab}
          />
          <div class="ml-auto flex flex-wrap items-center gap-2">
            <Button size="sm" disabled={scanning()} onClick={handleScanAll}>
              {t("media.admin.scan_all")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={scraping()}
              onClick={handleScrape}
            >
              {t("media.admin.scrape_now")}
            </Button>
            <DropdownMenu placement="bottom-end">
              <DropdownMenuTrigger
                as={Button}
                variant="outline"
                size="sm"
                aria-label={t("common.more_actions")}
              >
                <TbDots class="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onSelect={handleExportAll}>
                  {t("media.admin.export_all")}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={handleImportAll}>
                  {t("media.admin.import_data")}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={handleGenerateStrm}>
                  {t("media.admin.generate_strm")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={handleDeleteInvalid}>
                  {t("media.admin.delete_invalid")}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={handleClearScrape}>
                  {t("media.admin.clear_scrape")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  class="text-destructive focus:text-destructive"
                  onSelect={handleClearAll}
                >
                  {t("media.admin.clear_all")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-3 border-t pt-3">
          <Switch
            class="flex items-center gap-2"
            checked={config().enabled}
            onChange={(on) => setConfig((c) => ({ ...c, enabled: on }))}
          >
            <SwitchControl>
              <SwitchThumb />
            </SwitchControl>
            <SwitchLabel class="text-sm">
              {t("media.admin.enable_library", { title: props.title })}
            </SwitchLabel>
          </Switch>
          <Button
            size="sm"
            variant="secondary"
            disabled={configSaving()}
            onClick={handleSaveConfig}
          >
            {t("media.admin.save_config")}
          </Button>
          <Tooltip placement="top">
            <TooltipTrigger
              as="span"
              class="inline-flex cursor-help items-center text-warning"
              aria-label={t("media.admin.signing_warning")}
            >
              <TbAlertTriangle class="size-5" />
            </TooltipTrigger>
            <TooltipContent class="max-w-xs">
              {t("media.admin.signing_warning")}
            </TooltipContent>
          </Tooltip>
        </div>
        <Show when={progress()}>
          <Alert variant="success">
            <AlertDescription>
              {progress()!.status}
              <Show when={(progress()?.total ?? 0) > 0}>
                {" "}
                ({progress()!.current} / {progress()!.total})
              </Show>
            </AlertDescription>
          </Alert>
        </Show>
      </Card>

      {/* 扫描路径 */}
      <Show when={tab() === "paths"}>
        <ResourceList
          title={t("media.admin.scan_paths_count", {
            count: scanPaths().length,
          })}
          rows={scanPaths()}
          rowKey={(sp) => sp.id ?? sp.path}
          columns={pathColumns()}
          card={{
            title: (sp) => sp.name || sp.path,
            badges: (sp) => (
              <Show when={sp.type_tag}>
                <Badge variant="info">{sp.type_tag}</Badge>
              </Show>
            ),
            body: (sp) => (
              <span class="font-mono text-xs break-all">{sp.path}</span>
            ),
          }}
          primary={() => ({
            id: "edit",
            label: t("media.admin.edit"),
            onSelect: handleOpenEditScanPath,
          })}
          actions={pathActions}
          emptyText={t("media.admin.no_scan_paths")}
          toolbarActions={[
            {
              id: "add",
              label: t("media.admin.add_path"),
              icon: <TbPlus class="mr-1.5 size-4" />,
              onSelect: handleOpenCreateScanPath,
            },
          ]}
        />
      </Show>

      {/* 媒体管理 */}
      <Show when={tab() === "items"}>
        <div class="flex flex-col gap-3">
          <ResourceList
            title={t("media.admin.items_total", { total: total() })}
            rows={items()}
            rowKey={(item) => item.id}
            columns={itemColumns()}
            loading={itemsData.loading}
            card={{
              title: (item) => item.scraped_name || item.file_name,
              body: (item) => (
                <span class="break-all text-xs">{item.file_name}</span>
              ),
            }}
            primary={() => ({
              id: "edit",
              label: t("media.admin.edit"),
              onSelect: (item: MediaItem) => {
                setEditingItem({ ...item })
                setShowEditModal(true)
              },
            })}
            actions={itemActions}
            emptyText={t("media.admin.no_items")}
            toolbar={
              <>
                <SimpleSelect
                  class="h-9 w-48"
                  aria-label={t("media.admin.all_paths")}
                  options={[
                    { value: "0", label: t("media.admin.all_paths") },
                    ...scanPaths().map((sp) => ({
                      value: String(sp.id),
                      label: sp.name || sp.path,
                    })),
                  ]}
                  value={String(filterScanPathId())}
                  onChange={(v) => {
                    setFilterScanPathId(Number(v))
                    setPage(1)
                  }}
                />
                <Input
                  class="w-48"
                  placeholder={t("media.admin.search_placeholder")}
                  aria-label={t("media.admin.search_placeholder")}
                  value={searchInput()}
                  onInput={(e) => handleSearchInput(e.currentTarget.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      if (searchTimer) clearTimeout(searchTimer)
                      setFilterKeyword(searchInput())
                      setPage(1)
                    }
                  }}
                />
                <div class="flex items-center gap-2 text-sm text-muted-foreground">
                  {t("media.admin.per_page")}
                  <SimpleSelect
                    class="h-9 w-20"
                    aria-label={t("media.admin.per_page")}
                    options={perPageOptions()}
                    value={String(pageSize())}
                    onChange={(v) => {
                      setPageSize(Number(v))
                      setPage(1)
                    }}
                  />
                  {props.mediaType === "image"
                    ? t("media.admin.unit_image")
                    : t("media.admin.unit_item")}
                </div>
              </>
            }
          />

          {/* 分页 */}
          <Show when={total() > 0}>
            <div class="flex flex-wrap items-center justify-center gap-2 text-sm text-muted-foreground">
              <Button
                size="sm"
                variant="outline"
                aria-label={t("media.browser.first_page")}
                disabled={page() <= 1}
                onClick={() => setPage(1)}
              >
                <TbChevronsLeft class="size-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={page() <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <TbChevronLeft class="mr-1 size-4" />
                {t("media.admin.prev_page")}
              </Button>
              <span>
                {t("media.admin.page_info", {
                  page: page(),
                  totalPages: totalPages(),
                  total: total(),
                })}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={page() >= totalPages()}
                onClick={() => setPage((p) => Math.min(totalPages(), p + 1))}
              >
                {t("media.admin.next_page")}
                <TbChevronRight class="ml-1 size-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                aria-label={t("media.browser.last_page")}
                disabled={page() >= totalPages()}
                onClick={() => setPage(totalPages())}
              >
                <TbChevronsRight class="size-4" />
              </Button>
            </div>
          </Show>
        </div>
      </Show>

      {/* 缩略图设置（图片 / 书籍） */}
      <Show when={tab() === "settings" && supportsThumbnailSettings()}>
        <ThumbnailSettings mediaType={props.mediaType as "image" | "book"} />
      </Show>

      {/* 扫描路径弹窗 */}
      <Dialog open={showScanPathModal()} onOpenChange={setShowScanPathModal}>
        <DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editingScanPath()?.id
                ? t("media.admin.edit_scan_path")
                : t("media.admin.add_scan_path")}
            </DialogTitle>
            <DialogDescription class="sr-only">
              {t("media.admin.media_type_fixed", { type: props.title })}
            </DialogDescription>
          </DialogHeader>
          <div class="flex flex-col gap-4">
            <Field
              label={t("media.admin.col_path_name")}
              help={t("media.admin.name_helper")}
            >
              <Input
                placeholder={t("media.admin.name_placeholder")}
                value={editingScanPath()?.name ?? ""}
                onInput={(e) =>
                  setEditingScanPath((sp) => ({
                    ...sp!,
                    name: e.currentTarget.value,
                  }))
                }
              />
            </Field>
            <Field
              label={t("media.admin.col_scan_path")}
              help={t("media.admin.scan_path_helper")}
            >
              <Input
                placeholder="/movies"
                value={editingScanPath()?.path ?? "/"}
                onInput={(e) =>
                  setEditingScanPath((sp) => ({
                    ...sp!,
                    path: e.currentTarget.value,
                  }))
                }
              />
            </Field>
            <Field
              label={t("media.admin.col_type_tags")}
              help={t("media.admin.type_tag_helper")}
            >
              <Input
                placeholder={t("media.admin.type_tag_placeholder")}
                value={editingScanPath()?.type_tag ?? ""}
                onInput={(e) =>
                  setEditingScanPath((sp) => ({
                    ...sp!,
                    type_tag: e.currentTarget.value,
                  }))
                }
              />
            </Field>
            <Field
              label={t("media.admin.col_content_tags")}
              help={t("media.admin.content_tags_helper")}
            >
              <Input
                placeholder={t("media.admin.content_tags_placeholder")}
                value={editingScanPath()?.content_tags ?? ""}
                onInput={(e) =>
                  setEditingScanPath((sp) => ({
                    ...sp!,
                    content_tags: e.currentTarget.value,
                  }))
                }
              />
            </Field>
            <div class="flex flex-wrap gap-x-6 gap-y-3">
              <Switch
                class="flex items-center gap-2"
                checked={editingScanPath()?.path_merge ?? false}
                onChange={(on) =>
                  setEditingScanPath((sp) => ({ ...sp!, path_merge: on }))
                }
              >
                <SwitchControl>
                  <SwitchThumb />
                </SwitchControl>
                <SwitchLabel class="text-sm">
                  {t("media.admin.path_merge_mode")}
                </SwitchLabel>
              </Switch>
              <Switch
                class="flex items-center gap-2"
                checked={editingScanPath()?.enable_scrape ?? true}
                onChange={(on) =>
                  setEditingScanPath((sp) => ({ ...sp!, enable_scrape: on }))
                }
              >
                <SwitchControl>
                  <SwitchThumb />
                </SwitchControl>
                <SwitchLabel class="text-sm">
                  {t("media.admin.enable_scrape")}
                </SwitchLabel>
              </Switch>
            </div>
            <p class="m-0 text-xs text-muted-foreground">
              {t("media.admin.media_type_fixed", { type: props.title })}
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setShowScanPathModal(false)}
            >
              {t("global.cancel")}
            </Button>
            <Button disabled={scanPathSaving()} onClick={handleSaveScanPath}>
              {t("global.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 条目编辑弹窗 */}
      <Dialog open={showEditModal()} onOpenChange={setShowEditModal}>
        <DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{t("media.admin.edit_item_title")}</DialogTitle>
            <DialogDescription class="sr-only">
              {t("media.admin.edit_item_title")}
            </DialogDescription>
          </DialogHeader>
          <div class="flex flex-col gap-3">
            <For
              each={[
                { key: "scraped_name", label: t("media.admin.item_name") },
                { key: "cover", label: t("media.admin.item_cover_url") },
                {
                  key: "release_date",
                  label: t("media.admin.item_release_date"),
                },
                { key: "genre", label: t("media.admin.item_genre") },
                { key: "authors", label: t("media.admin.item_authors") },
              ]}
            >
              {(field) => (
                <Field label={field.label}>
                  <Input
                    value={
                      ((editingItem() as any)?.[field.key] as string) ?? ""
                    }
                    onInput={(e) =>
                      setEditingItem((item) => ({
                        ...item!,
                        [field.key]: e.currentTarget.value,
                      }))
                    }
                  />
                </Field>
              )}
            </For>
            <Field label={t("media.admin.rating_label")}>
              <Input
                type="number"
                min="0"
                max="10"
                step="0.1"
                value={editingItem()?.rating ?? 0}
                onInput={(e) =>
                  setEditingItem((item) => ({
                    ...item!,
                    rating: parseFloat(e.currentTarget.value),
                  }))
                }
              />
            </Field>
            <Field label={t("media.admin.summary")}>
              <Textarea
                rows={3}
                value={editingItem()?.description ?? ""}
                onInput={(e) =>
                  setEditingItem((item) => ({
                    ...item!,
                    description: e.currentTarget.value,
                  }))
                }
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setShowEditModal(false)}>
              {t("global.cancel")}
            </Button>
            <Button onClick={handleSaveItem}>{t("global.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 确认弹窗 */}
      <ConfirmDialog
        open={!!confirmState()}
        onOpenChange={(open) => !open && setConfirmState(null)}
        title={confirmState()?.title ?? ""}
        description={
          <span class="whitespace-pre-line">{confirmState()?.message}</span>
        }
        confirmLabel={confirmState()?.confirmText}
        destructive={confirmState()?.danger}
        loading={confirming()}
        onConfirm={runConfirm}
      />
    </div>
  )
}

// ==================== 4个具体管理页 ====================

export const VideoManage = () => {
  const t = useT()
  return (
    <MediaManagePage mediaType="video" title={t("media.admin.title_video")} />
  )
}

export const MusicManage = () => {
  const t = useT()
  return (
    <MediaManagePage mediaType="music" title={t("media.admin.title_music")} />
  )
}

export const ImageManage = () => {
  const t = useT()
  return (
    <MediaManagePage mediaType="image" title={t("media.admin.title_image")} />
  )
}

export const BookManage = () => {
  const t = useT()
  return (
    <MediaManagePage mediaType="book" title={t("media.admin.title_book")} />
  )
}
