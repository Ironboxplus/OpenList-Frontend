import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { CheckboxField } from "~/components/ui/toggle-field"
import { AdvancedGroup } from "~/components/ui/advanced-group"
import { createSignal, For, onCleanup, onMount, Show } from "solid-js"
import { TbCircleCheck } from "solid-icons/tb"
import { Progress } from "~/components/ui/progress"
import { MotionTokens, playOnce } from "~/platform/motion"
import { usePath, useRouter, useT } from "~/hooks"
import { getMainColor, uploadConfig, setUploadConfig } from "~/store"
import {
  RiDocumentFolderUploadFill,
  RiDocumentFileUploadFill,
} from "solid-icons/ri"
import { bus, getFileSize, notify, pathJoin } from "~/utils"
import { asyncPool } from "~/utils/async_pool"
import {
  isFinishedUpload,
  localUploads,
} from "~/features/transfers/local-uploads"
import { UploadFileProps, StatusBadge } from "./types"
import { File2Upload } from "./util"
import { filesOfDrop } from "./drop"
import { SelectWrapper } from "~/components"
import { getUploads } from "./uploads"
import { acceptUploads, takeUploadIntent } from "./upload-intent"
import { SeedFormat, SeedHashAlgorithm, SeedHashMatrix } from "~/types"

const UploadFile = (props: UploadFileProps & { onRetry?: () => void }) => {
  const t = useT()
  return (
    <div
      class="flex w-full flex-col items-start gap-y-1 rounded-lg border border-border p-2 hover:border-(--main)"
      style={{ "--main": getMainColor() }}
    >
      <p class="break-all">{props.path}</p>
      <div class="flex flex-row items-center w-full justify-between gap-x-2">
        <div class="flex flex-row items-center gap-x-2">
          <Badge variant={StatusBadge[props.status]}>
            {t(`home.upload.${props.status}`)}
          </Badge>
          <p>{getFileSize(props.speed)}/s</p>
        </div>
        <div class="flex flex-row items-center gap-x-2">
          <Show when={props.status === "error" && props.onRetry}>
            <Button
              variant="subtle"
              size="xs"
              onClick={() => props.onRetry?.()}
            >
              {t("home.upload.retry")}
            </Button>
          </Show>
          <p class="text-muted-foreground">{getFileSize(props.size)}</p>
        </div>
      </div>
      <div class="flex flex-row items-center w-full gap-x-2">
        <Progress
          value={props.progress}
          aria-label={props.path}
          class="flex-1"
        />
        {/* done: a check turns up next to the full bar (plan §P4) */}
        <Show when={props.status === "success"}>
          <span
            data-testid="progress-done"
            data-motion="progress-done"
            class="inline-flex text-success"
            ref={(el) =>
              playOnce(
                el,
                { opacity: [0, 1], transform: ["scale(0.6)", "scale(1)"] },
                MotionTokens.options.iconSwap,
              )
            }
          >
            <TbCircleCheck class="size-4" aria-hidden="true" />
          </span>
        </Show>
      </div>
      <p class="text-destructive">{props.msg}</p>
    </div>
  )
}

const Upload = () => {
  const t = useT()
  const { pathname } = useRouter()
  const { refresh } = usePath()
  const [drag, setDrag] = createSignal(false)
  // The records live in the transfers source, so the panel comes back with
  // them after the page was left and the Task Center shows the same ones.
  const [uploading, setUploading] = createSignal(localUploads.list().length > 0)
  const [sidecars, setSidecars] = createSignal<SeedFormat[]>([])
  const [seedPieceSize, setSeedPieceSize] = createSignal(10 * 1024 * 1024)
  const [seedMatrix, setSeedMatrix] = createSignal<SeedHashMatrix>({
    md5: { whole: false, pieces: false },
    sha1: { whole: false, pieces: false },
    sha256: { whole: false, pieces: false },
  })
  const allDone = () =>
    localUploads.list().every(({ status }) => isFinishedUpload(status))
  let fileInput!: HTMLInputElement
  let folderInput!: HTMLInputElement
  onMount(() => {
    const kind = takeUploadIntent()
    // files dropped on the file list come with the panel
    if (Array.isArray(kind)) void handleAddFiles(kind)
    else if (kind) (kind === "folder" ? folderInput : fileInput)?.click()
    acceptUploads((files) => void handleAddFiles(files))
  })
  onCleanup(() => acceptUploads(undefined))
  const handleAddFiles = async (files: File[]) => {
    if (files.length === 0) return
    setUploading(true)
    // The folder is fixed when the files are added, not when each one starts.
    const dir = pathname()
    const queued = files.map((file) => {
      const upload = File2Upload(file)
      const target = pathJoin(dir, upload.path)
      // The retry closure keeps the File handle for as long as the record lives.
      const id = localUploads.add(
        upload,
        target,
        (id) => void handleFile(id, file, target),
      )
      return { id, file, target }
    })
    for await (const ms of asyncPool(3, queued, ({ id, file, target }) =>
      handleFile(id, file, target),
    )) {
      console.log(ms)
    }
    refresh()
    // 再次延迟刷新一次，以便能看到后端异步生成的 BT 文件（如 189/189pc 驱动的 .cas.torrent）
    setTimeout(() => refresh(undefined, true), 5000)
  }

  // All upload methods are available by default
  const uploaders = getUploads()
  const [curUploader, setCurUploader] = createSignal(uploaders[0])
  // multipart sessions are synchronous pipelines with their own progress and
  // retry semantics; "add as task" does not apply to them
  const effectiveUploader = () =>
    sidecars().length
      ? uploaders.find((uploader) => uploader.name === "Stream")!
      : curUploader()
  // the upload method and the seed sidecars are rarely changed: folded under
  // Advanced (PLAN_FE_SYSTEM_UX_1127 P3); the hashes and the piece size come
  // with a sidecar
  const [advanced, setAdvanced] = createSignal(false)
  const advancedCount = () => (sidecars().length ? 4 : 2)
  const advancedChanged = () =>
    Number(curUploader() !== uploaders[0]) + Number(sidecars().length > 0)
  const asTaskUnsupported = () =>
    sidecars().length > 0 || effectiveUploader()?.name === "Multipart"
  const effectiveSeedMatrix = (): SeedHashMatrix => ({
    md5: sidecars().includes("cas")
      ? { whole: true, pieces: true }
      : seedMatrix().md5,
    sha1: sidecars().includes("torrent")
      ? { whole: true, pieces: true }
      : seedMatrix().sha1,
    sha256: seedMatrix().sha256,
  })
  const toggleSidecar = (format: SeedFormat, checked: boolean) => {
    setSidecars((current) =>
      checked
        ? Array.from(new Set([...current, format]))
        : current.filter((item) => item !== format),
    )
    if (format === "cas" && checked) setSeedPieceSize(10 * 1024 * 1024)
  }
  const setSeedHash = (
    algorithm: SeedHashAlgorithm,
    scope: "whole" | "pieces",
    checked: boolean,
  ) => {
    setSeedMatrix((current) => ({
      ...current,
      [algorithm]: { ...current[algorithm], [scope]: checked },
    }))
  }
  const handleFile = async (id: string, file: File, uploadPath: string) => {
    const setUpload = (key: keyof UploadFileProps, value: any) =>
      localUploads.update(id, key, value)
    setUpload("status", "uploading")
    try {
      const err = await effectiveUploader()
        .upload(
          uploadPath,
          file,
          setUpload,
          asTaskUnsupported() ? false : uploadConfig.asTask,
          uploadConfig.overwrite,
          uploadConfig.rapid,
          {
            formats: sidecars(),
            hash_matrix: effectiveSeedMatrix(),
            piece_size: seedPieceSize(),
          },
        )
        .catch((err) => err)
      if (!err) {
        setUpload("status", "success")
        setUpload("progress", 100)
        if (uploadConfig.asTask) bus.emit("tasks:refresh")
      } else {
        setUpload("status", "error")
        setUpload("msg", err.message)
      }
    } catch (e: any) {
      console.error(e)
      setUpload("status", "error")
      setUpload("msg", e.message)
    }
  }
  return (
    <div class="flex flex-col items-center w-full pb-2 gap-y-2">
      <Show
        when={!uploading()}
        fallback={
          <>
            <div class="flex flex-row items-center gap-x-2">
              <Button
                variant="subtle"
                onClick={() => {
                  localUploads.clearFinished(["success", "error"])
                }}
              >
                {t("home.upload.clear_done")}
              </Button>
              <Show when={allDone()}>
                <Button
                  variant="subtle"
                  onClick={() => {
                    setUploading(false)
                  }}
                >
                  {t("home.upload.back")}
                </Button>
              </Show>
            </div>
            <For each={localUploads.list()}>
              {(upload) => (
                <UploadFile
                  {...upload}
                  onRetry={() => localUploads.restart(upload.id)}
                />
              )}
            </For>
          </>
        }
      >
        <input
          type="file"
          multiple
          ref={fileInput}
          class="hidden"
          onChange={(e) => {
            handleAddFiles(Array.from(e.currentTarget.files ?? []))
          }}
        />
        <input
          type="file"
          multiple
          // @ts-ignore
          webkitdirectory
          ref={folderInput}
          class="hidden"
          onChange={(e) => {
            handleAddFiles(Array.from(e.currentTarget.files ?? []))
          }}
        />
        <div
          class="flex min-h-56 w-full flex-col items-center justify-center gap-y-4 rounded-lg border-2 border-dashed p-6"
          classList={{
            "border-(--main)": drag(),
            "border-border": !drag(),
          }}
          style={{ "--main": getMainColor() }}
          onDragOver={(e: DragEvent) => {
            e.preventDefault()
            setDrag(true)
          }}
          onDragLeave={() => {
            setDrag(false)
          }}
          onDrop={async (e: DragEvent) => {
            e.preventDefault()
            e.stopPropagation()
            setDrag(false)
            const res = await filesOfDrop(e.dataTransfer)
            if (res.length === 0) {
              notify.warning(t("home.upload.no_files_drag"))
            }
            handleAddFiles(res)
          }}
        >
          <Show
            when={!drag()}
            fallback={<h2 class="font-semibold">{t("home.upload.release")}</h2>}
          >
            <h2 class="font-semibold text-center text-lg leading-7">
              {t("home.upload.upload-tips")}
            </h2>
            <div class="flex flex-row items-center gap-x-4">
              <div class="flex flex-col items-center gap-y-2">
                <Button
                  variant="subtle"
                  class="size-16"
                  aria-label={t("home.upload.upload_folder")}
                  onClick={() => {
                    folderInput.click()
                  }}
                >
                  <RiDocumentFolderUploadFill size="1.2em" />
                </Button>
                <p class="text-sm text-muted-foreground text-center">
                  {t("home.upload.upload_folder")}
                </p>
              </div>

              <div class="flex flex-col items-center gap-y-2">
                <Button
                  variant="subtle"
                  class="size-16"
                  aria-label={t("home.upload.upload_files")}
                  onClick={() => {
                    fileInput.click()
                  }}
                >
                  <RiDocumentFileUploadFill size="1.2em" />
                </Button>
                <p class="text-sm text-muted-foreground text-center">
                  {t("home.upload.upload_files")}
                </p>
              </div>
            </div>
            <div class="flex flex-col gap-2 md:flex-row md:gap-4">
              <CheckboxField
                checked={!asTaskUnsupported() && uploadConfig.asTask}
                disabled={asTaskUnsupported()}
                onChange={(on) => setUploadConfig({ asTask: on })}
              >
                {t("home.upload.add_as_task")}
              </CheckboxField>
              <CheckboxField
                checked={uploadConfig.overwrite}
                onChange={(on) => setUploadConfig({ overwrite: on })}
              >
                {t("home.conflict_policy.overwrite_existing")}
              </CheckboxField>
              <CheckboxField
                checked={uploadConfig.rapid}
                onChange={(on) => setUploadConfig({ rapid: on })}
              >
                {t("home.upload.try_rapid")}
              </CheckboxField>
            </div>
            <div class="w-full">
              <AdvancedGroup
                title={t("global.advanced")}
                count={advancedCount()}
                changed={advancedChanged()}
                open={advanced()}
                onOpenChange={setAdvanced}
                testid="advanced-upload"
              >
                <div class="max-w-64">
                  <p class="text-sm mb-1">{t("home.upload.method")}</p>
                  <SelectWrapper
                    value={curUploader()?.name}
                    onChange={(name) => {
                      setCurUploader(
                        uploaders.find((uploader) => uploader.name === name)!,
                      )
                    }}
                    options={uploaders.map((uploader) => {
                      return {
                        label: uploader.name,
                        value: uploader.name,
                      }
                    })}
                  />
                </div>
                <div class="flex flex-col w-full items-stretch gap-y-2">
                  <p class="text-sm font-semibold">
                    {t("home.upload.sidecars")}
                  </p>
                  <div class="flex flex-row items-center flex-wrap gap-x-4">
                    <For each={["torrent", "cas", "oss"] as SeedFormat[]}>
                      {(format) => (
                        <CheckboxField
                          checked={sidecars().includes(format)}
                          onChange={(on) => toggleSidecar(format, on)}
                        >
                          {format.toUpperCase()}
                        </CheckboxField>
                      )}
                    </For>
                  </div>
                  <p class="text-xs text-muted-foreground">
                    {t("home.upload.sidecars_hint")}
                  </p>
                  <Show when={sidecars().length > 0}>
                    <div class="grid grid-cols-1 gap-2 md:grid-cols-3">
                      <For
                        each={["md5", "sha1", "sha256"] as SeedHashAlgorithm[]}
                      >
                        {(algorithm) => {
                          const forced = () =>
                            (algorithm === "sha1" &&
                              sidecars().includes("torrent")) ||
                            (algorithm === "md5" && sidecars().includes("cas"))
                          return (
                            <div class="flex flex-col items-start border border-border rounded-md p-2 gap-y-1">
                              <p class="text-sm font-semibold">
                                {algorithm.toUpperCase()}
                              </p>
                              <CheckboxField
                                checked={effectiveSeedMatrix()[algorithm].whole}
                                disabled={forced()}
                                onChange={(on) =>
                                  setSeedHash(algorithm, "whole", on)
                                }
                              >
                                {t("home.transfer_seed.whole")}
                              </CheckboxField>
                              <CheckboxField
                                checked={
                                  effectiveSeedMatrix()[algorithm].pieces
                                }
                                disabled={forced()}
                                onChange={(on) =>
                                  setSeedHash(algorithm, "pieces", on)
                                }
                              >
                                {t("home.transfer_seed.pieces")}
                              </CheckboxField>
                            </div>
                          )
                        }}
                      </For>
                    </div>
                    <div class="max-w-48">
                      <p class="text-sm mb-1">
                        {t("home.transfer_seed.piece_size")}
                      </p>
                      <SelectWrapper
                        value={seedPieceSize().toString()}
                        onChange={(value) => setSeedPieceSize(Number(value))}
                        options={(sidecars().includes("cas")
                          ? [10]
                          : [1, 2, 4, 8, 10, 16]
                        ).map((size) => ({
                          value: String(size * 1024 * 1024),
                          label: `${size} MiB`,
                        }))}
                      />
                    </div>
                  </Show>
                </div>
              </AdvancedGroup>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  )
}

export default Upload
