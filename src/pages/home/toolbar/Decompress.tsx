import { useFetch, usePath, useRouter, useT } from "~/hooks"
import { bus, fsArchiveDecompress, handleRespWithNotifySuccess } from "~/utils"
import { batch, createSignal, onCleanup } from "solid-js"
import { ModalFolderChoose } from "~/components"
import { selectedObjs } from "~/store"
import { CreateFolderButton } from "./CopyMove"
import { createDisclosure } from "~/components/overlay"
import { AdvancedGroup } from "~/components/ui/advanced-group"
import { Input } from "~/components/ui/input"
import { CheckboxField } from "~/components/ui/toggle-field"

export const Decompress = () => {
  const t = useT()
  const { isOpen, onOpen, onClose } = createDisclosure()
  const [loading, ok] = useFetch(fsArchiveDecompress)
  const { pathname } = useRouter()
  const { refresh } = usePath()
  const [innerPath, setInnerPath] = createSignal("")
  const [archivePass, setArchivePass] = createSignal("")
  const [cacheFull, setCacheFull] = createSignal(true)
  // what Cache full starts as: on for a whole archive, off for a part of one
  const [cacheDefault, setCacheDefault] = createSignal(true)
  const [putIntoNewDir, setPutIntoNewDir] = createSignal(false)
  const [overwrite, setOverwrite] = createSignal(false)
  const [srcPath, setSrcPath] = createSignal("")
  const [srcName, setSrcName] = createSignal<string[]>()
  // Cache full and Into a new folder are rarely changed: folded under
  // Advanced (PLAN_FE_SYSTEM_UX_1127 P3), open when one is not at its default
  const changed = () =>
    Number(cacheFull() !== cacheDefault()) + Number(putIntoNewDir())
  const [advanced, setAdvanced] = createSignal(false)
  const handler = (name: string) => {
    if (name === "decompress") {
      const path = pathname()
      batch(() => {
        setSrcPath(path)
        setSrcName(selectedObjs().map((o) => o.name))
        setCacheFull(true)
        setCacheDefault(true)
        setInnerPath("/")
        setArchivePass("")
        setAdvanced(changed() > 0)
      })
      onOpen()
    }
  }
  const extractHandler = (args: string) => {
    const { inner, pass } = JSON.parse(args)
    const path = pathname()
    const idx = path.lastIndexOf("/")
    batch(() => {
      setSrcPath(path.slice(0, idx))
      setSrcName([path.slice(idx + 1)])
      setCacheFull(false)
      setCacheDefault(false)
      setInnerPath(inner)
      setArchivePass(pass)
      setAdvanced(changed() > 0)
    })
    onOpen()
  }
  bus.on("tool", handler)
  bus.on("extract", extractHandler)
  onCleanup(() => {
    bus.off("tool", handler)
    bus.off("extract", extractHandler)
  })
  const header = () => {
    if (innerPath() === "/") {
      return t("home.toolbar.choose_dst_folder")
    }
    return t("home.toolbar.archive.extract_header", { path: innerPath() })
  }
  return (
    <ModalFolderChoose
      header={header()}
      opened={isOpen()}
      onClose={onClose}
      loading={loading()}
      defaultValue={srcPath}
      headerSlot={(handler) => <CreateFolderButton handler={handler} />}
      footerSlot={
        <div class="flex flex-col items-center w-full gap-y-2">
          <CheckboxField
            class="mr-auto"
            checked={overwrite()}
            onChange={setOverwrite}
          >
            {t("home.conflict_policy.overwrite_existing")}
          </CheckboxField>
        </div>
      }
      onSubmit={async (dst) => {
        const resp = await ok(
          srcPath(),
          dst,
          srcName(),
          archivePass(),
          innerPath(),
          cacheFull(),
          putIntoNewDir(),
          overwrite(),
        )
        handleRespWithNotifySuccess(resp, () => {
          bus.emit("tasks:refresh")
          refresh()
          onClose()
        })
      }}
    >
      <div class="flex flex-col items-start gap-y-1">
        <div class="flex flex-row items-center w-full gap-x-1">
          <p class="text-sm whitespace-nowrap">
            {t(`home.toolbar.decompress-pass`)}
          </p>
          <Input
            class="h-8 grow"
            value={archivePass()}
            onInput={(e: any) => setArchivePass(e.target.value as string)}
          />
        </div>
        <div class="w-full">
          <AdvancedGroup
            title={t("global.advanced")}
            count={2}
            changed={changed()}
            open={advanced()}
            onOpenChange={setAdvanced}
            testid="advanced-decompress"
          >
            <CheckboxField checked={cacheFull()} onChange={setCacheFull}>
              {t(`home.toolbar.decompress-cache-full`)}
            </CheckboxField>
            <CheckboxField
              checked={putIntoNewDir()}
              onChange={setPutIntoNewDir}
            >
              {t(`home.toolbar.decompress-put-into-new`)}
            </CheckboxField>
          </AdvancedGroup>
        </div>
      </div>
    </ModalFolderChoose>
  )
}
