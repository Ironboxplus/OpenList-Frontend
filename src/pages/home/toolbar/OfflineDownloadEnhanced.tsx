import { SelectWrapper, FolderChooseInput } from "~/components"
import { useFetch, usePath, useRouter, useT } from "~/hooks"
import {
  offlineDownload,
  fsGet,
  torrentParse,
  torrentRapidUpload,
  seedCapabilities,
  seedGenerate,
  bus,
  handleRespWithNotifySuccess,
  handleResp,
  notify,
  r,
} from "~/utils"
import {
  createSignal,
  onCleanup,
  onMount,
  Show,
  createMemo,
  createEffect,
  For,
} from "solid-js"
import {
  PResp,
  SeedCapabilities,
  SeedCapabilityFile,
  SeedFormat,
  SeedGenerateResult,
  SeedHashAlgorithm,
  SeedHashMatrix,
  TorrentInfo,
} from "~/types"
import bencode from "bencode"
import crypto from "crypto-js"
import { TorrentFileList } from "./TorrentFileList"
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  createDisclosure,
} from "~/components/overlay"
import { AdvancedGroup } from "~/components/ui/advanced-group"
import { Input, Textarea } from "~/components/ui/input"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { CheckboxField } from "~/components/ui/toggle-field"

const deletePolicies = [
  "upload_download_stream",
  "delete_on_upload_succeed",
  "delete_on_upload_failed",
  "delete_never",
  "delete_always",
] as const

type DeletePolicy = (typeof deletePolicies)[number]

// Tab 类型
type TabType = "link" | "torrent"

function utf8Decode(data: Uint8Array): string {
  return crypto.enc.Utf8.stringify(crypto.lib.WordArray.create(data))
}

function toMagnetUrl(torrentBuffer: Uint8Array) {
  const data = bencode.decode(torrentBuffer as any)
  const infoEncode = bencode.encode(data.info) as unknown as Uint8Array
  const infoHash = crypto
    .SHA1(crypto.lib.WordArray.create(infoEncode))
    .toString()
  let params = {} as any
  if (Number.isInteger(data?.info?.length)) {
    params.xl = data.info.length
  }
  if (data.info.name) {
    params.dn = utf8Decode(data.info.name)
  }
  if (data.announce) {
    params.tr = utf8Decode(data.announce)
  }
  const paramStr = new URLSearchParams(params).toString()
  return `magnet:?xt=urn:btih:${infoHash}${paramStr ? "&" + paramStr : ""}`
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ""
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
}

export const TransferSeedGenerator = () => {
  const t = useT()
  const { pathname } = useRouter()
  const { refresh } = usePath()
  const { isOpen, onOpen, onClose } = createDisclosure()
  const [paths, setPaths] = createSignal<string[]>([])
  const [formats, setFormats] = createSignal<SeedFormat[]>([])
  const [pieceSize, setPieceSize] = createSignal(10 * 1024 * 1024)
  const [comment, setComment] = createSignal("")
  const [trackers, setTrackers] = createSignal<string[]>([])
  const [availableTrackers, setAvailableTrackers] = createSignal<string[]>([])
  const [shareFiles, setShareFiles] = createSignal<string[]>([])
  const [directFiles, setDirectFiles] = createSignal<string[]>([])
  const [outputPath, setOutputPath] = createSignal("")
  const [seedName, setSeedName] = createSignal("")
  const [fileComments, setFileComments] = createSignal<Record<string, string>>(
    {},
  )
  const [capabilities, setCapabilities] = createSignal<SeedCapabilities | null>(
    null,
  )
  const [checking, setChecking] = createSignal(false)
  const [generating, setGenerating] = createSignal(false)
  const [matrix, setMatrix] = createSignal<SeedHashMatrix>({
    md5: { whole: false, pieces: false },
    sha1: { whole: false, pieces: false },
    sha256: { whole: false, pieces: false },
  })

  // the matrix the selection's hashes preselect (loadCapabilities)
  const [baseMatrix, setBaseMatrix] = createSignal<SeedHashMatrix>(matrix())
  // The hashes, the piece size, the comment and the trackers are rarely
  // changed: folded under Advanced (PLAN_FE_SYSTEM_UX_1127 P3)
  const [advanced, setAdvanced] = createSignal(false)
  const advancedCount = () => (availableTrackers().length > 0 ? 4 : 3)
  const advancedChanged = () =>
    Number(JSON.stringify(matrix()) !== JSON.stringify(baseMatrix())) +
    Number(pieceSize() !== 10 * 1024 * 1024) +
    Number(comment().trim() !== "") +
    Number(trackers().length > 0)

  const effectiveMatrix = createMemo<SeedHashMatrix>(() => {
    const value = matrix()
    return {
      md5: formats().includes("cas")
        ? { whole: true, pieces: true }
        : value.md5,
      sha1: formats().includes("torrent")
        ? { whole: true, pieces: true }
        : value.sha1,
      sha256: value.sha256,
    }
  })

  const setHashScope = (
    algorithm: SeedHashAlgorithm,
    scope: "whole" | "pieces",
    checked: boolean,
  ) => {
    setMatrix((previous) => ({
      ...previous,
      [algorithm]: { ...previous[algorithm], [scope]: checked },
    }))
  }

  const toggleFormat = (format: SeedFormat, checked: boolean) => {
    setFormats((current) =>
      checked
        ? Array.from(new Set([...current, format]))
        : current.filter((item) => item !== format),
    )
    if (format === "cas" && checked) setPieceSize(10 * 1024 * 1024)
  }

  const loadCapabilities = async (selectedPaths: string[]) => {
    setChecking(true)
    try {
      const resp = await seedCapabilities(selectedPaths)
      handleResp(resp, (value) => {
        setCapabilities(value)
        setAvailableTrackers(value.trackers || [])
        // Drop formats the backend just declared unsupported for this selection.
        setFormats((current) =>
          current.filter((format) => value.formats?.[format] !== false),
        )
        // Preselect only hashes shared by every selected file. Fall back to the
        // configured matrix only when the driver reports no hashes at all.
        const provided = new Set<string>()
        const files = value.files || []
        for (const hash of files[0]?.available_hashes || []) {
          if (
            files.every((file) => (file.available_hashes || []).includes(hash))
          ) {
            provided.add(hash)
          }
        }
        const defaultMatrix = value.default_matrix
        const hasProvided = provided.size > 0
        const reuseOnly = value.hash_reuse_only === true
        const preselected: SeedHashMatrix = {
          md5: {
            whole: hasProvided
              ? provided.has("md5")
              : !!defaultMatrix?.md5?.whole,
            pieces: reuseOnly
              ? false
              : hasProvided
                ? false
                : !!defaultMatrix?.md5?.pieces,
          },
          sha1: {
            whole: hasProvided
              ? provided.has("sha1")
              : !!defaultMatrix?.sha1?.whole,
            pieces: reuseOnly
              ? false
              : hasProvided
                ? false
                : !!defaultMatrix?.sha1?.pieces,
          },
          sha256: {
            whole: hasProvided
              ? provided.has("sha256")
              : !!defaultMatrix?.sha256?.whole,
            pieces: reuseOnly
              ? false
              : hasProvided
                ? false
                : !!defaultMatrix?.sha256?.pieces,
          },
        }
        setMatrix(preselected)
        setBaseMatrix(preselected)
      })
    } finally {
      setChecking(false)
    }
  }

  const openHandler = (payload: { paths: string[] }) => {
    setPaths(payload.paths)
    setOutputPath(pathname())
    setSeedName("")
    setCapabilities(null)
    setFormats([])
    setPieceSize(10 * 1024 * 1024)
    setComment("")
    setTrackers([])
    setAvailableTrackers([])
    setShareFiles([])
    setDirectFiles([])
    setFileComments({})
    setAdvanced(false)
    onOpen()
    void loadCapabilities(payload.paths)
  }
  bus.on("generate_transfer_seed", openHandler)
  onCleanup(() => bus.off("generate_transfer_seed", openHandler))

  const handleGenerate = async () => {
    if (!formats().length || !paths().length) return
    setGenerating(true)
    try {
      const resp = await seedGenerate({
        paths: paths(),
        formats: formats(),
        hash_matrix: effectiveMatrix(),
        piece_size: pieceSize(),
        comment: comment().trim() || undefined,
        file_comments: fileComments(),
        trackers: trackers(),
        share_files: shareFiles(),
        direct_files: directFiles(),
        output_path: outputPath(),
        name: seedName().trim() || undefined,
      })
      handleResp(resp, (data: SeedGenerateResult) => {
        if (data?.task || data?.async) {
          notify.success(t("home.transfer_seed.async_task_created"))
        }
        refresh(undefined, true)
        onClose()
      })
    } finally {
      setGenerating(false)
    }
  }

  const capabilityFiles = () => capabilities()?.files ?? []
  const reuseOnly = () => capabilities()?.hash_reuse_only === true

  // Hashes shared by every selected file: only those can be turned into a
  // seed without downloading the content again.
  const availableWholeHashes = createMemo<Set<SeedHashAlgorithm>>(() => {
    const files = capabilityFiles()
    if (!files.length) return new Set()
    const first = files[0].available_hashes || []
    return new Set(
      first.filter((algorithm) =>
        files.every((file) =>
          (file.available_hashes || []).includes(algorithm),
        ),
      ),
    )
  })

  const availablePieceHashes = createMemo<Set<SeedHashAlgorithm>>(() => {
    const files = capabilityFiles()
    if (!files.length) return new Set()
    const first = files[0].available_piece_hashes || []
    return new Set(
      first.filter((algorithm) =>
        files.every((file) =>
          (file.available_piece_hashes || []).includes(algorithm),
        ),
      ),
    )
  })

  const missingHashes = (file: SeedCapabilityFile): SeedHashAlgorithm[] => {
    const matrix = effectiveMatrix()
    const whole = new Set(file.available_hashes || [])
    const pieces = new Set(file.available_piece_hashes || [])
    const missing: SeedHashAlgorithm[] = []
    if (matrix.md5.whole && !whole.has("md5")) missing.push("md5")
    if (matrix.sha1.whole && !whole.has("sha1")) missing.push("sha1")
    if (matrix.sha256.whole && !whole.has("sha256")) missing.push("sha256")
    if (matrix.md5.pieces && !pieces.has("md5")) missing.push("md5")
    if (matrix.sha1.pieces && !pieces.has("sha1")) missing.push("sha1")
    if (matrix.sha256.pieces && !pieces.has("sha256")) missing.push("sha256")
    return missing
  }

  // 根据用户选择的格式 + 哈希矩阵，判断该文件是否需要下载计算哈希。
  // Go 后端在缺少哈希时会下载计算；TS 后端（hash_reuse_only）只复用驱动
  // 已返回的哈希，因此这里不再承诺下载。
  const requiresDownload = (file: SeedCapabilityFile): boolean => {
    if (reuseOnly()) return false
    const matrix = effectiveMatrix()
    if (matrix.md5.pieces || matrix.sha1.pieces || matrix.sha256.pieces) {
      return true
    }
    const available = new Set(file.available_hashes || [])
    if (matrix.md5.whole && !available.has("md5")) return true
    if (matrix.sha1.whole && !available.has("sha1")) return true
    if (matrix.sha256.whole && !available.has("sha256")) return true
    return false
  }

  // 是否有文件缺少所选哈希，导致当前后端无法生成（禁止生成）。
  const hasUnsupportedHashes = () =>
    reuseOnly() &&
    capabilityFiles().some((file) => missingHashes(file).length > 0)

  // 是否有文件需要下载计算哈希，但驱动不支持流式下载（禁止生成）。
  const hasUnstreamableDownload = () =>
    capabilityFiles().some(
      (file) => requiresDownload(file) && file.streamable === false,
    )

  // the fix for either is in the folded hashes: open them
  createEffect(() => {
    if (hasUnsupportedHashes() || hasUnstreamableDownload()) setAdvanced(true)
  })

  const toggleTracker = (tracker: string, checked: boolean) => {
    setTrackers((current) =>
      checked
        ? Array.from(new Set([...current, tracker]))
        : current.filter((item) => item !== tracker),
    )
  }

  const toggleShareFile = (path: string, checked: boolean) => {
    setShareFiles((current) =>
      checked
        ? Array.from(new Set([...current, path]))
        : current.filter((item) => item !== path),
    )
  }

  const toggleDirectFile = (path: string, checked: boolean) => {
    setDirectFiles((current) =>
      checked
        ? Array.from(new Set([...current, path]))
        : current.filter((item) => item !== path),
    )
  }

  return (
    <Modal size="xl" opened={isOpen()} onClose={onClose}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{t("home.transfer_seed.generate_title")}</ModalHeader>
        <ModalBody>
          <div class="flex flex-col items-stretch gap-y-4">
            <div>
              <p class="text-sm font-semibold mb-2">
                {t("home.transfer_seed.formats")}
              </p>
              <div class="flex flex-row items-center flex-wrap gap-x-4">
                <For each={["torrent", "cas", "oss"] as SeedFormat[]}>
                  {(format) => (
                    <CheckboxField
                      checked={formats().includes(format)}
                      disabled={
                        capabilities()?.formats?.[format] === false &&
                        !formats().includes(format)
                      }
                      onChange={(on) => toggleFormat(format, on)}
                    >
                      {format.toUpperCase()}
                    </CheckboxField>
                  )}
                </For>
              </div>
            </div>

            <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <p class="text-sm mb-1">{t("home.transfer_seed.seed_name")}</p>
                <Input
                  id="transfer-seed-name"
                  placeholder={t("home.transfer_seed.seed_name_placeholder")}
                  value={seedName()}
                  onInput={(e) => setSeedName(e.currentTarget.value)}
                />
              </div>
              <div>
                <p class="text-sm mb-1">
                  {t("home.transfer_seed.output_path")}
                </p>
                <FolderChooseInput
                  id="transfer-seed-output"
                  value={outputPath()}
                  onChange={setOutputPath}
                />
              </div>
            </div>

            <div class="w-full">
              <AdvancedGroup
                title={t("global.advanced")}
                count={advancedCount()}
                changed={advancedChanged()}
                open={advanced()}
                onOpenChange={setAdvanced}
                testid="advanced-seed"
              >
                <div>
                  <p class="text-sm font-semibold mb-2">
                    {t("home.transfer_seed.hash_matrix")}
                  </p>
                  <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <For
                      each={["md5", "sha1", "sha256"] as SeedHashAlgorithm[]}
                    >
                      {(algorithm) => {
                        const forced = () =>
                          (algorithm === "sha1" &&
                            formats().includes("torrent")) ||
                          (algorithm === "md5" && formats().includes("cas"))
                        return (
                          <div class="flex flex-col items-start border border-border rounded-md p-2 gap-y-1">
                            <p class="font-semibold">
                              {algorithm.toUpperCase()}
                            </p>
                            <CheckboxField
                              checked={effectiveMatrix()[algorithm].whole}
                              disabled={
                                forced() ||
                                (reuseOnly() &&
                                  !availableWholeHashes().has(algorithm))
                              }
                              onChange={(on) =>
                                setHashScope(algorithm, "whole", on)
                              }
                            >
                              {t("home.transfer_seed.whole")}
                            </CheckboxField>
                            <CheckboxField
                              checked={effectiveMatrix()[algorithm].pieces}
                              disabled={
                                forced() ||
                                (reuseOnly() &&
                                  !availablePieceHashes().has(algorithm))
                              }
                              onChange={(on) =>
                                setHashScope(algorithm, "pieces", on)
                              }
                            >
                              {t("home.transfer_seed.pieces")}
                            </CheckboxField>
                            <Show when={forced()}>
                              <p class="text-xs text-muted-foreground">
                                {t("home.transfer_seed.required_by_format")}
                              </p>
                            </Show>
                          </div>
                        )
                      }}
                    </For>
                  </div>
                </div>

                <div class="max-w-48">
                  <p class="text-sm mb-1">
                    {t("home.transfer_seed.piece_size")}
                  </p>
                  <SelectWrapper
                    value={pieceSize().toString()}
                    onChange={(value) => setPieceSize(Number(value))}
                    options={(formats().includes("cas")
                      ? [10]
                      : [1, 2, 4, 8, 10, 16]
                    ).map((size) => ({
                      value: String(size * 1024 * 1024),
                      label: `${size} MiB`,
                    }))}
                  />
                </div>

                <div>
                  <p class="text-sm mb-1">{t("home.transfer_seed.comment")}</p>
                  <Input
                    value={comment()}
                    onInput={(e) => setComment(e.currentTarget.value)}
                  />
                </div>
                <Show when={availableTrackers().length > 0}>
                  <div>
                    <p class="text-sm font-semibold mb-2">
                      {t("home.transfer_seed.trackers")}
                    </p>
                    <div class="flex flex-row items-center flex-wrap gap-x-4">
                      <For each={availableTrackers()}>
                        {(tracker) => (
                          <CheckboxField
                            checked={trackers().includes(tracker)}
                            onChange={(on) => toggleTracker(tracker, on)}
                          >
                            <span class="text-xs break-all">{tracker}</span>
                          </CheckboxField>
                        )}
                      </For>
                    </div>
                  </div>
                </Show>
              </AdvancedGroup>
            </div>

            <div class="border border-border rounded-md p-3 max-h-[360px] overflow-y-auto">
              <Show
                when={!checking()}
                fallback={<p>{t("home.transfer_seed.checking")}</p>}
              >
                <div class="flex flex-row items-center justify-between mb-2 flex-wrap">
                  <p class="font-semibold">
                    {t("home.transfer_seed.capability_summary")}
                  </p>
                  <Badge variant="info">
                    {t("home.transfer_seed.estimated_traffic")}:{" "}
                    {formatFileSize(
                      capabilities()?.estimated_traffic ??
                        capabilityFiles().reduce(
                          (sum, file) => sum + (file.estimated_traffic ?? 0),
                          0,
                        ),
                    )}
                  </Badge>
                </div>
                <For each={capabilityFiles()}>
                  {(file) => {
                    const directAvailable = () =>
                      file.direct_source_available !== false
                    const shareAvailable = () => file.share_available !== false
                    return (
                      <div class="flex flex-col items-stretch mb-3 p-2 border border-border rounded-md gap-y-2">
                        <div class="flex flex-row items-center justify-between flex-wrap">
                          <p class="text-sm break-all">
                            {file.source_path || file.path}
                          </p>
                          <p class="text-xs text-muted-foreground">
                            {formatFileSize(file.size || 0)}
                          </p>
                        </div>
                        <div class="flex flex-row items-center flex-wrap gap-x-1">
                          <For
                            each={
                              file.available_hashes ||
                              file.existing_hashes ||
                              []
                            }
                          >
                            {(hash) => (
                              <Badge variant="success">
                                {hash.toUpperCase()}
                              </Badge>
                            )}
                          </For>
                          <Show
                            when={reuseOnly() && missingHashes(file).length > 0}
                          >
                            <Badge variant="danger">
                              {t("home.transfer_seed.missing_hashes", {
                                hashes: missingHashes(file).join(", "),
                              })}
                            </Badge>
                          </Show>
                          <Show when={!reuseOnly() && requiresDownload(file)}>
                            <Badge variant="warning">
                              {t("home.transfer_seed.requires_fetch")}
                            </Badge>
                          </Show>
                          <Show
                            when={
                              !requiresDownload(file) &&
                              !(reuseOnly() && missingHashes(file).length > 0)
                            }
                          >
                            <Badge variant="success">
                              {t("home.transfer_seed.direct_generate")}
                            </Badge>
                          </Show>
                          <Show
                            when={
                              !reuseOnly() &&
                              requiresDownload(file) &&
                              file.streamable === false
                            }
                          >
                            <Badge variant="danger">
                              {t("home.transfer_seed.cannot_stream")}
                            </Badge>
                          </Show>
                          <For each={file.missing_reasons || []}>
                            {(reason) => (
                              <Badge variant="danger">{reason}</Badge>
                            )}
                          </For>
                        </div>
                        <div class="flex flex-row items-center flex-wrap gap-x-4">
                          <CheckboxField
                            checked={shareFiles().includes(
                              file.source_path || file.path,
                            )}
                            disabled={!shareAvailable()}
                            onChange={(on) =>
                              toggleShareFile(file.source_path || file.path, on)
                            }
                          >
                            {t("home.transfer_seed.include_share")}
                          </CheckboxField>
                          <CheckboxField
                            checked={directFiles().includes(
                              file.source_path || file.path,
                            )}
                            disabled={!directAvailable()}
                            onChange={(on) =>
                              toggleDirectFile(
                                file.source_path || file.path,
                                on,
                              )
                            }
                          >
                            {t("home.transfer_seed.include_direct_source")}
                          </CheckboxField>
                        </div>
                        <Input
                          class="h-8"
                          placeholder={t("home.transfer_seed.file_comment")}
                          value={fileComments()[file.path] || ""}
                          onInput={(event) =>
                            setFileComments((current) => ({
                              ...current,
                              [file.path]: event.currentTarget.value,
                            }))
                          }
                        />
                      </div>
                    )
                  }}
                </For>
                <Show when={!capabilityFiles().length && paths().length}>
                  <For each={paths()}>
                    {(path) => <p class="text-sm">{path}</p>}
                  </For>
                </Show>
              </Show>
            </div>
          </div>
        </ModalBody>
        <ModalFooter class="flex items-center gap-2">
          <Show when={hasUnsupportedHashes()}>
            <p class="flex-1 text-xs break-all text-destructive">
              {t("home.transfer_seed.hash_reuse_only_hint")}
            </p>
          </Show>
          <Show when={!hasUnsupportedHashes() && hasUnstreamableDownload()}>
            <p class="flex-1 text-xs break-all text-destructive">
              {t("home.transfer_seed.cannot_stream_hint")}
            </p>
          </Show>
          <Button variant="secondary" onClick={onClose}>
            {t("global.cancel")}
          </Button>
          <Button
            variant="subtle"
            loading={generating()}
            disabled={
              !formats().length ||
              checking() ||
              hasUnstreamableDownload() ||
              hasUnsupportedHashes()
            }
            onClick={handleGenerate}
          >
            {t("home.transfer_seed.generate")}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export const OfflineDownloadEnhanced = () => {
  const t = useT()
  const { pathname } = useRouter()

  // 下载工具列表
  const [tools, setTools] = createSignal([] as string[])
  const [toolsLoading, reqTool] = useFetch((path: string): PResp<string[]> => {
    const query = path ? `?path=${encodeURIComponent(path)}` : ""
    return r.get(`/public/offline_download_tools${query}`)
  })
  const [tool, setTool] = createSignal("")
  const [deletePolicy, setDeletePolicy] = createSignal<DeletePolicy>(
    "upload_download_stream",
  )

  // 对话框状态
  const { isOpen, onOpen, onClose } = createDisclosure()
  const [activeTab, setActiveTab] = createSignal<TabType>("link")

  // 链接下载状态
  const [linkValue, setLinkValue] = createSignal("")
  const [linkLoading, submitLink] = useFetch(offlineDownload)

  // BT 下载状态
  const [torrentInfo, setTorrentInfo] = createSignal<TorrentInfo | null>(null)
  const [torrentData, setTorrentData] = createSignal<string>("") // Base64 编码
  const [selectedFiles, setSelectedFiles] = createSignal<number[]>([])
  const [btLoading, setBtLoading] = createSignal(false)
  const [parsing, setParsing] = createSignal(false)

  // 保存路径
  const [savePath, setSavePath] = createSignal("")
  const [savePathProvider, setSavePathProvider] = createSignal("")
  const savePathProviderCache = new Map<string, string>()
  let savePathProviderTimer: ReturnType<typeof setTimeout> | undefined

  let savePathProviderRequestSeq = 0
  const clearSavePathProviderTimer = () => {
    if (savePathProviderTimer) {
      clearTimeout(savePathProviderTimer)
      savePathProviderTimer = undefined
    }
  }

  const updateSavePathProvider = (path: string) => {
    const normalizedPath = path.trim()
    clearSavePathProviderTimer()
    if (!normalizedPath) {
      setSavePathProvider("")
      return
    }

    const cachedProvider = savePathProviderCache.get(normalizedPath)
    if (cachedProvider !== undefined) {
      setSavePathProvider(cachedProvider)
      return
    }

    // Clear stale provider immediately to avoid using previous path's provider.
    setSavePathProvider("")
    const requestSeq = ++savePathProviderRequestSeq
    savePathProviderTimer = setTimeout(async () => {
      try {
        const resp = await fsGet(normalizedPath)
        if (requestSeq !== savePathProviderRequestSeq) {
          return
        }
        if (resp.code === 200) {
          const provider = resp.data.provider || ""
          savePathProviderCache.set(normalizedPath, provider)
          setSavePathProvider(provider)
        } else {
          setSavePathProvider("")
        }
      } catch {
        if (requestSeq === savePathProviderRequestSeq) {
          setSavePathProvider("")
        }
      }
    }, 250)
  }

  // 秒传状态
  const [rapidUploading, setRapidUploading] = createSignal(false)
  const [rapidUploadResult, setRapidUploadResult] = createSignal<string>("")
  // 秒传失败后允许回退到普通离线下载
  const [casRapidUploadFailed, setCasRapidUploadFailed] =
    createSignal<boolean>(false)

  // 检测输入中是否包含 ed2k 链接
  const hasEd2kLinks = createMemo(() => {
    return linkValue()
      .split("\n")
      .some((line) => line.trim().toLowerCase().startsWith("ed2k://"))
  })

  // 当有 CAS 信息且秒传尚未失败时，默认使用天翼云秒传（不需要 aria2）
  const shouldUseCasRapidUpload = createMemo(() => {
    return (
      activeTab() === "torrent" &&
      !!torrentInfo()?.has_cas &&
      savePathProvider() === "189CloudPC" &&
      !casRapidUploadFailed()
    )
  })

  // 仅在 BT 且包含 CAS 信息时才查询目标路径 provider，减少无效请求。
  createEffect(() => {
    const shouldCheckProvider =
      activeTab() === "torrent" && !!torrentInfo()?.has_cas
    if (!shouldCheckProvider) {
      clearSavePathProviderTimer()
      setSavePathProvider("")
      return
    }
    updateSavePathProvider(savePath())
  })

  // 检测输入中是否包含磁力链
  const hasMagnetLinks = createMemo(() => {
    return linkValue()
      .split("\n")
      .some((line) => line.trim().toLowerCase().startsWith("magnet:?"))
  })

  // 是否应该禁用 SimpleHttp（BT种子/磁力链/ed2k 场景不支持）
  const shouldDisableSimpleHttp = createMemo(() => {
    return activeTab() === "torrent" || hasEd2kLinks() || hasMagnetLinks()
  })

  // 可用的工具列表（根据场景过滤）
  const availableTools = createMemo(() => {
    if (shouldDisableSimpleHttp()) {
      return tools().filter((t) => t !== "SimpleHttp")
    }
    return tools()
  })

  // 当 SimpleHttp 被禁用时，自动切换到第一个可用工具
  createEffect(() => {
    if (shouldDisableSimpleHttp() && tool() === "SimpleHttp") {
      const available = availableTools()
      if (available.length > 0) {
        setTool(available[0])
      }
    }
  })

  const loadTools = async (path: string) => {
    const resp = await reqTool(path)
    handleResp(resp, (data) => {
      setTools(data)
      setTool(data[0])
    })
  }

  onMount(() => loadTools(pathname()))

  // 监听 bus 事件
  const handler = (name: string) => {
    if (name === "offline_download") {
      const currentPath = pathname()
      setSavePath(currentPath)
      void loadTools(currentPath)
      onOpen()
    }
  }
  bus.on("tool", handler)
  onCleanup(() => {
    bus.off("tool", handler)
  })

  // 监听从右键菜单触发的 torrent 解析事件
  const torrentHandler = (data: { torrentData: string; info: TorrentInfo }) => {
    setTorrentData(data.torrentData)
    setTorrentInfo(data.info)
    setSelectedFiles(data.info.files.map((_, i) => i))
    setActiveTab("torrent")
    const currentPath = pathname()
    setSavePath(currentPath)
    onOpen()
  }
  bus.on("torrent_parsed", torrentHandler)
  onCleanup(() => {
    bus.off("torrent_parsed", torrentHandler)
  })

  // 生成 CAS 文件并下载（纯前端）
  const handleGenerateCASFile = () => {
    const info = torrentInfo()
    if (!info?.has_cas || !info.cas) return
    try {
      const casJson = JSON.stringify({
        md5: info.cas.file_md5,
        name: info.name,
        size: info.total_size,
        sliceMd5: info.cas.slice_md5,
      })
      const casContent = btoa(casJson)
      const blob = new Blob([casContent], { type: "text/plain;charset=utf-8" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${info.name}.cas`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      notify.success(
        t("home.toolbar.offline_download_enhanced.cas_file_generated"),
      )
    } catch (err) {
      notify.error(
        t("home.toolbar.offline_download_enhanced.cas_file_generate_failed"),
        { description: String(err) },
      )
    }
  }

  // 重置状态
  const resetState = () => {
    clearSavePathProviderTimer()
    savePathProviderRequestSeq += 1
    setLinkValue("")
    setTorrentInfo(null)
    setTorrentData("")
    setSelectedFiles([])
    setSavePathProvider("")
    setRapidUploadResult("")
    setCasRapidUploadFailed(false)
  }

  const handleClose = () => {
    resetState()
    onClose()
  }

  onCleanup(() => {
    clearSavePathProviderTimer()
  })

  // 处理 torrent 文件拖拽/选择
  const handleTorrentFile = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      notify.error(
        t("home.toolbar.offline_download_enhanced.torrent_too_large"),
      )
      return
    }

    setParsing(true)
    try {
      const buffer = await file.arrayBuffer()
      const base64Data = arrayBufferToBase64(buffer)

      const resp = await torrentParse(base64Data)
      handleResp(resp, (data) => {
        setTorrentInfo(data)
        setTorrentData(base64Data)
        setSelectedFiles(data.files.map((_, i) => i))
      })
    } catch (err) {
      notify.error(t("home.toolbar.offline_download_enhanced.parse_failed"), {
        description: String(err),
      })
    } finally {
      setParsing(false)
    }
  }

  // 拖拽处理
  const handleDrop = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!e.dataTransfer?.files.length) return

    if (activeTab() === "torrent") {
      // BT Tab: 解析第一个 torrent 文件
      for (const file of e.dataTransfer.files) {
        if (file.name.toLowerCase().endsWith(".torrent")) {
          handleTorrentFile(file)
          return
        }
      }
    } else {
      // Link Tab: 将 torrent 文件转换为磁力链追加到输入框
      const processFiles = async () => {
        const values: string[] = []
        for (const file of e.dataTransfer!.files) {
          if (file.name.toLowerCase().endsWith(".torrent")) {
            try {
              const buffer = await file.arrayBuffer()
              values.push(toMagnetUrl(new Uint8Array(buffer)))
            } catch (err) {
              console.error("Failed to convert torrent:", err)
            }
          }
        }
        if (values.length) {
          setLinkValue((prev) =>
            prev ? prev + "\n" + values.join("\n") : values.join("\n"),
          )
        }
      }
      processFiles()
    }
  }

  // 文件选择处理
  const handleFileSelect = () => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = ".torrent"
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        handleTorrentFile(file)
      }
    }
    input.click()
  }

  // 提交链接下载
  const handleLinkSubmit = async () => {
    if (!linkValue().trim()) return
    const urls = linkValue()
      .split("\n")
      .filter((u) => u.trim())
    const resp = await submitLink(savePath(), urls, tool(), deletePolicy())
    handleRespWithNotifySuccess(resp, () => {
      bus.emit("tasks:refresh")
      handleClose()
    })
  }

  // 提交 BT 下载
  const handleBtSubmit = async () => {
    const info = torrentInfo()
    if (!info || !torrentData()) return

    setBtLoading(true)
    try {
      // 有 CAS 信息且秒传尚未失败时，默认直接走天翼云秒传
      if (shouldUseCasRapidUpload()) {
        setRapidUploading(true)
        try {
          const resp = await torrentRapidUpload(torrentData(), savePath())
          if (resp.code === 200) {
            setRapidUploadResult("success")
            notify.success(
              t("home.toolbar.offline_download_enhanced.rapid_upload_success"),
              { description: resp.data.file_name },
            )
            handleClose()
            return
          } else {
            // 秒传失败，标记允许回退到普通离线下载
            setCasRapidUploadFailed(true)
            notify.warning(
              t(
                "home.toolbar.offline_download_enhanced.cas_rapid_upload_failed",
              ),
              { description: resp.message },
            )
          }
        } catch (err) {
          // 秒传异常，标记允许回退到普通离线下载
          setCasRapidUploadFailed(true)
          notify.error(
            t("home.toolbar.offline_download_enhanced.cas_rapid_upload_failed"),
            { description: String(err) },
          )
        } finally {
          setRapidUploading(false)
        }
        // 秒传失败后返回，让用户选择是否继续普通离线下载
        return
      }

      // 无 CAS 信息或秒传失败后，走正常离线下载流程
      // SimpleHttp 不支持磁力链/BT 下载
      if (tool() === "SimpleHttp") {
        notify.warning(
          t("home.toolbar.offline_download_enhanced.simplehttp_not_supported"),
        )
        return
      }

      // 正常离线下载：将 torrent 转为磁力链提交
      const buffer = Uint8Array.from(atob(torrentData()), (c) =>
        c.charCodeAt(0),
      )
      const magnetUrl = toMagnetUrl(buffer)
      const resp = await offlineDownload(
        savePath(),
        [magnetUrl],
        tool(),
        deletePolicy(),
      )
      handleRespWithNotifySuccess(resp, () => {
        bus.emit("tasks:refresh")
        handleClose()
      })
    } finally {
      setBtLoading(false)
    }
  }

  return (
    <Modal
      size="xl"
      blockScrollOnMount={false}
      opened={isOpen()}
      onClose={handleClose}
    >
      <ModalOverlay />
      <ModalContent
        onDragOver={(e: DragEvent) => {
          e.preventDefault()
          e.stopPropagation()
        }}
        onDrop={handleDrop}
      >
        <ModalHeader>{t("home.toolbar.offline_download")}</ModalHeader>
        <ModalBody>
          {/* Tab 切换 */}
          <div class="flex flex-row items-center mb-3 gap-x-2">
            <Button
              size="sm"
              variant={activeTab() === "link" ? "default" : "outline"}
              onClick={() => setActiveTab("link")}
            >
              {t("home.toolbar.offline_download_enhanced.tab_link")}
            </Button>
            <Button
              size="sm"
              variant={activeTab() === "torrent" ? "default" : "outline"}
              onClick={() => setActiveTab("torrent")}
            >
              {t("home.toolbar.offline_download_enhanced.tab_bt")}
            </Button>
          </div>

          {/* 链接下载 Tab */}
          <Show when={activeTab() === "link"}>
            <div class="flex flex-col items-stretch gap-y-2">
              <Textarea
                class="min-h-[120px]"
                placeholder={t(
                  "home.toolbar.offline_download_enhanced.link_placeholder",
                )}
                value={linkValue()}
                onInput={(e) => setLinkValue(e.currentTarget.value)}
              />
              <p class="text-xs text-muted-foreground">
                {t("home.toolbar.offline_download_enhanced.link_tips")}
              </p>
            </div>
          </Show>

          {/* BT 下载 Tab */}
          <Show when={activeTab() === "torrent"}>
            <div class="flex flex-col items-stretch gap-y-3">
              {/* 未解析时显示上传区域 */}
              <Show when={!torrentInfo()}>
                <div
                  class="border-2 border-dashed border-border rounded-md p-6 text-center cursor-pointer hover:border-primary hover:bg-primary/10"
                  onClick={handleFileSelect}
                >
                  <Show
                    when={parsing()}
                    fallback={
                      <div class="flex flex-col items-center gap-y-2">
                        <p class="text-lg font-bold">
                          {t(
                            "home.toolbar.offline_download_enhanced.drop_torrent",
                          )}
                        </p>
                        <p class="text-sm text-muted-foreground">
                          {t(
                            "home.toolbar.offline_download_enhanced.click_to_select",
                          )}
                        </p>
                      </div>
                    }
                  >
                    <p>{t("home.toolbar.offline_download_enhanced.parsing")}</p>
                  </Show>
                </div>
              </Show>

              {/* 已解析时显示文件列表 */}
              <Show when={torrentInfo()}>
                <div class="flex flex-col items-stretch gap-y-2">
                  {/* 种子信息头部 */}
                  <div class="flex flex-row justify-between items-center">
                    <div class="flex flex-col items-start gap-y-1">
                      <h2 class="text-sm font-semibold break-all">
                        {torrentInfo()!.name}
                      </h2>
                      <div class="flex flex-row items-center gap-x-2">
                        <p class="text-xs text-muted-foreground">
                          {formatFileSize(torrentInfo()!.total_size)}
                        </p>
                        <p class="text-xs text-muted-foreground">
                          {torrentInfo()!.files.length}{" "}
                          {t(
                            "home.toolbar.offline_download_enhanced.files_count",
                          )}
                        </p>
                      </div>
                    </div>
                    <div class="flex flex-row items-center gap-x-2">
                      <Show when={torrentInfo()!.has_cas}>
                        <Badge variant="success">
                          {t(
                            "home.toolbar.offline_download_enhanced.cas_supported",
                          )}
                        </Badge>
                      </Show>
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() => {
                          setTorrentInfo(null)
                          setTorrentData("")
                          setSelectedFiles([])
                        }}
                      >
                        {t("home.toolbar.offline_download_enhanced.reselect")}
                      </Button>
                    </div>
                  </div>

                  {/* 文件列表 */}
                  <TorrentFileList
                    files={torrentInfo()!.files}
                    selectedFiles={selectedFiles()}
                    onSelectionChange={setSelectedFiles}
                  />
                  <p class="text-xs text-muted-foreground mt-1">
                    {t(
                      "home.toolbar.offline_download_enhanced.file_selection_hint",
                    )}
                  </p>
                </div>
              </Show>
            </div>
          </Show>

          {/* 公共选项区域 */}
          <div class="flex flex-col mt-3 items-stretch gap-y-2">
            {/* 保存路径 */}
            <div>
              <p class="text-sm mb-1 font-medium">
                {t("home.toolbar.offline_download_enhanced.save_path")}
              </p>
              <FolderChooseInput
                value={savePath()}
                onChange={setSavePath}
                id="offline-download-path"
              />
            </div>

            {/* 下载工具选择（CAS 秒传模式下隐藏） */}
            <Show when={!shouldUseCasRapidUpload()}>
              <div>
                <p class="text-sm mb-1 font-medium">
                  {t("home.toolbar.offline_download_enhanced.download_tool")}
                </p>
                <SelectWrapper
                  value={
                    shouldDisableSimpleHttp() && tool() === "SimpleHttp"
                      ? availableTools()[0] || ""
                      : tool()
                  }
                  onChange={(v) => {
                    if (
                      v !== "SimpleHttp" &&
                      deletePolicy() === "upload_download_stream"
                    ) {
                      setDeletePolicy("delete_on_upload_succeed")
                    }
                    setTool(v)
                  }}
                  options={availableTools().map((t) => ({
                    value: t,
                    label: t,
                  }))}
                />
                <Show
                  when={
                    shouldDisableSimpleHttp() && tools().includes("SimpleHttp")
                  }
                >
                  <p class="text-xs text-muted-foreground mt-1">
                    {t(
                      "home.toolbar.offline_download_enhanced.simplehttp_not_supported",
                    )}
                  </p>
                </Show>
              </div>

              {/* 删除策略 */}
              <div>
                <p class="text-sm mb-1 font-medium">
                  {t("home.toolbar.offline_download_enhanced.delete_policy")}
                </p>
                <SelectWrapper
                  value={deletePolicy()}
                  onChange={(v) => setDeletePolicy(v as DeletePolicy)}
                  options={deletePolicies
                    .filter((policy) =>
                      policy === "upload_download_stream"
                        ? tool() === "SimpleHttp"
                        : true,
                    )
                    .map((policy) => ({
                      value: policy,
                      label: t(`home.toolbar.delete_policy.${policy}`),
                    }))}
                />
              </div>
            </Show>

            {/* CAS 秒传提示 */}
            <Show when={shouldUseCasRapidUpload()}>
              <div class="rounded-sm border p-2 border-success/40 bg-success/10">
                <p class="text-sm text-success">
                  {t(
                    "home.toolbar.offline_download_enhanced.cas_rapid_upload_mode",
                  )}
                </p>
              </div>
              {/* 生成 CAS 文件按钮 */}
              <Button
                size="sm"
                variant="outline"
                onClick={handleGenerateCASFile}
              >
                {t("home.toolbar.offline_download_enhanced.generate_cas_file")}
              </Button>
            </Show>

            {/* CAS 秒传失败后，提示用户可继续普通离线下载 */}
            <Show
              when={
                activeTab() === "torrent" &&
                torrentInfo()?.has_cas &&
                casRapidUploadFailed()
              }
            >
              <div class="rounded-sm border p-2 border-warning/50 bg-warning/10">
                <p class="text-sm text-warning">
                  {t(
                    "home.toolbar.offline_download_enhanced.cas_failed_fallback_hint",
                  )}
                </p>
              </div>
            </Show>

            <Show
              when={
                activeTab() === "torrent" &&
                torrentInfo() &&
                !torrentInfo()!.has_cas
              }
            >
              <div class="rounded-sm border p-2 border-warning/50 bg-warning/10">
                <p class="text-sm text-warning">
                  {t("home.toolbar.offline_download_enhanced.no_cas_hint")}
                </p>
              </div>
            </Show>

            {/* ed2k 链接工具提示 */}
            <Show
              when={
                activeTab() === "link" &&
                hasEd2kLinks() &&
                (tool() === "aria2" ||
                  tool() === "SimpleHttp" ||
                  tool() === "qBittorrent")
              }
            >
              <div class="rounded-sm border p-2 border-warning/50 bg-warning/10">
                <p class="text-sm text-warning">
                  {t("home.toolbar.offline_download_enhanced.ed2k_tool_hint")}
                </p>
              </div>
            </Show>
          </div>
        </ModalBody>

        <ModalFooter class="flex gap-2">
          <Button variant="secondary" onClick={handleClose}>
            {t("global.cancel")}
          </Button>
          <Show when={activeTab() === "link"}>
            <Button
              variant="subtle"
              loading={linkLoading()}
              onClick={handleLinkSubmit}
              disabled={!linkValue().trim()}
            >
              {t("home.toolbar.offline_download_enhanced.start_download")}
            </Button>
          </Show>
          <Show when={activeTab() === "torrent"}>
            <Button
              variant="subtle"
              loading={btLoading() || rapidUploading()}
              onClick={handleBtSubmit}
              disabled={!torrentInfo()}
            >
              <Show
                when={shouldUseCasRapidUpload() && !rapidUploading()}
                fallback={t(
                  "home.toolbar.offline_download_enhanced.start_download",
                )}
              >
                {t(
                  "home.toolbar.offline_download_enhanced.rapid_upload_and_download",
                )}
              </Show>
            </Button>
          </Show>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
