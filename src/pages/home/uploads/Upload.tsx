import {
  VStack,
  Input,
  Heading,
  HStack,
  IconButton,
  Checkbox,
  Text,
  Badge,
  Progress,
  ProgressIndicator,
  Button,
  Box,
  Stack,
} from "@hope-ui/solid"
import { createSignal, For, Show } from "solid-js"
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
import { File2Upload, traverseFileTree } from "./util"
import { SelectWrapper } from "~/components"
import { getUploads } from "./uploads"

const UploadFile = (props: UploadFileProps & { onRetry?: () => void }) => {
  const t = useT()
  return (
    <VStack
      w="$full"
      spacing="$1"
      rounded="$lg"
      border="1px solid $neutral7"
      alignItems="start"
      p="$2"
      _hover={{
        border: `1px solid ${getMainColor()}`,
      }}
    >
      <Text
        css={{
          wordBreak: "break-all",
        }}
      >
        {props.path}
      </Text>
      <HStack spacing="$2" w="$full" justifyContent="space-between">
        <HStack spacing="$2">
          <Badge colorScheme={StatusBadge[props.status]}>
            {t(`home.upload.${props.status}`)}
          </Badge>
          <Text>{getFileSize(props.speed)}/s</Text>
        </HStack>
        <HStack spacing="$2">
          <Show when={props.status === "error" && props.onRetry}>
            <Button
              compact
              size="xs"
              colorScheme="accent"
              onClick={() => props.onRetry?.()}
            >
              {t("home.upload.retry")}
            </Button>
          </Show>
          <Text color="$neutral11">{getFileSize(props.size)}</Text>
        </HStack>
      </HStack>
      <Progress
        w="$full"
        trackColor="$info3"
        rounded="$full"
        value={props.progress}
        size="sm"
      >
        <ProgressIndicator color={getMainColor()} rounded="$md" />
        {/* <ProgressLabel /> */}
      </Progress>
      <Text color="$danger10">{props.msg}</Text>
    </VStack>
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
  const allDone = () =>
    localUploads.list().every(({ status }) => isFinishedUpload(status))
  let fileInput!: HTMLInputElement
  let folderInput!: HTMLInputElement
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
  const asTaskUnsupported = () => curUploader()?.name === "Multipart"
  const handleFile = async (id: string, file: File, uploadPath: string) => {
    const setUpload = (key: keyof UploadFileProps, value: any) =>
      localUploads.update(id, key, value)
    setUpload("status", "uploading")
    try {
      const err = await curUploader()
        .upload(
          uploadPath,
          file,
          setUpload,
          asTaskUnsupported() ? false : uploadConfig.asTask,
          uploadConfig.overwrite,
          uploadConfig.rapid,
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
    <VStack w="$full" pb="$2" spacing="$2">
      <Show
        when={!uploading()}
        fallback={
          <>
            <HStack spacing="$2">
              <Button
                colorScheme="accent"
                onClick={() => {
                  localUploads.clearFinished(["success", "error"])
                }}
              >
                {t("home.upload.clear_done")}
              </Button>
              <Show when={allDone()}>
                <Button
                  onClick={() => {
                    setUploading(false)
                  }}
                >
                  {t("home.upload.back")}
                </Button>
              </Show>
            </HStack>
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
        <Input
          type="file"
          multiple
          ref={fileInput}
          display="none"
          onChange={(e) => {
            // @ts-ignore
            handleAddFiles(Array.from(e.target.files ?? []))
          }}
        />
        <Input
          type="file"
          multiple
          // @ts-ignore
          webkitdirectory
          ref={folderInput}
          display="none"
          onChange={(e) => {
            // @ts-ignore
            handleAddFiles(Array.from(e.target.files ?? []))
          }}
        />
        <VStack
          w="$full"
          justifyContent="center"
          border={`2px dashed ${drag() ? getMainColor() : "$neutral8"}`}
          rounded="$lg"
          spacing="$4"
          p="$6"
          minH="$56"
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
            const res: File[] = []
            const items = Array.from(e.dataTransfer?.items ?? [])
            const files = Array.from(e.dataTransfer?.files ?? [])
            let itemLength = items.length
            const folderEntries = []
            for (let i = 0; i < itemLength; i++) {
              const item = items[i]
              const entry = item.webkitGetAsEntry()
              if (entry?.isFile) {
                res.push(files[i])
              } else if (entry?.isDirectory) {
                folderEntries.push(entry)
              }
            }
            for (const entry of folderEntries) {
              const innerFiles = await traverseFileTree(entry)
              res.push(...innerFiles)
            }
            if (res.length === 0) {
              notify.warning(t("home.upload.no_files_drag"))
            }
            handleAddFiles(res)
          }}
        >
          <Show
            when={!drag()}
            fallback={<Heading>{t("home.upload.release")}</Heading>}
          >
            <Heading size="lg" textAlign="center">
              {t("home.upload.upload-tips")}
            </Heading>
            <Box w={{ "@initial": "80%", "@md": "30%" }}>
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
            </Box>
            <HStack spacing="$4">
              <VStack spacing="$2" alignItems="center">
                <IconButton
                  compact
                  size="xl"
                  aria-label={t("home.upload.upload_folder")}
                  colorScheme="accent"
                  icon={<RiDocumentFolderUploadFill size="1.2em" />}
                  onClick={() => {
                    folderInput.click()
                  }}
                />
                <Text fontSize="$sm" color="$neutral11" textAlign="center">
                  {t("home.upload.upload_folder")}
                </Text>
              </VStack>

              <VStack spacing="$2" alignItems="center">
                <IconButton
                  compact
                  size="xl"
                  aria-label={t("home.upload.upload_files")}
                  icon={<RiDocumentFileUploadFill size="1.2em" />}
                  onClick={() => {
                    fileInput.click()
                  }}
                />
                <Text fontSize="$sm" color="$neutral11" textAlign="center">
                  {t("home.upload.upload_files")}
                </Text>
              </VStack>
            </HStack>
            <Stack
              spacing={{ "@initial": "$2", "@md": "$4" }}
              direction={{ "@initial": "column", "@md": "row" }}
            >
              <Checkbox
                checked={!asTaskUnsupported() && uploadConfig.asTask}
                disabled={asTaskUnsupported()}
                onChange={() => {
                  setUploadConfig({ asTask: !uploadConfig.asTask })
                }}
              >
                {t("home.upload.add_as_task")}
              </Checkbox>
              <Checkbox
                checked={uploadConfig.overwrite}
                onChange={() => {
                  setUploadConfig({ overwrite: !uploadConfig.overwrite })
                }}
              >
                {t("home.conflict_policy.overwrite_existing")}
              </Checkbox>
              <Checkbox
                checked={uploadConfig.rapid}
                onChange={() => {
                  setUploadConfig({ rapid: !uploadConfig.rapid })
                }}
              >
                {t("home.upload.try_rapid")}
              </Checkbox>
            </Stack>
          </Show>
        </VStack>
      </Show>
    </VStack>
  )
}

export default Upload
