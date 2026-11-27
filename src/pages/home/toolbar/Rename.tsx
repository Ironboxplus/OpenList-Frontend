import { Checkbox, VStack } from "@hope-ui/solid"
import { createSignal, onCleanup, Show } from "solid-js"
import { ModalInput } from "~/components"
import { useFetch, usePath, useRouter, useT } from "~/hooks"
import { oneChecked, selectedObjs } from "~/store"
import { bus, fsRename, handleResp, notify, pathJoin } from "~/utils"
import { createDisclosure } from "~/components/overlay"
import { offerUndo } from "~/features/files/undo"

export const Rename = () => {
  const t = useT()
  const { isOpen, onOpen, onClose } = createDisclosure()
  const [loading, ok] = useFetch(fsRename)
  const { pathname } = useRouter()
  const { refresh } = usePath()
  const [overwrite, setOverwrite] = createSignal(false)
  const [followSeed, setFollowSeed] = createSignal(false)
  const handler = (name: string) => {
    if (name === "rename") {
      if (!oneChecked()) {
        bus.emit("tool", "batchRename")
        return
      }
      onOpen()
      setOverwrite(false)
      setFollowSeed(false)
    }
  }
  bus.on("tool", handler)
  onCleanup(() => {
    bus.off("tool", handler)
  })
  return (
    <Show when={isOpen()}>
      <ModalInput
        title="home.toolbar.input_new_name"
        validateFilename={true}
        footerSlot={
          <VStack mr="auto" spacing="$2" alignItems="start">
            <Checkbox
              checked={overwrite()}
              onChange={() => setOverwrite(!overwrite())}
            >
              {t("home.conflict_policy.overwrite_existing")}
            </Checkbox>
            <Checkbox
              checked={followSeed()}
              disabled={selectedObjs()[0]?.is_dir}
              onChange={() => setFollowSeed(!followSeed())}
            >
              {t("home.toolbar.follow_seed")}
            </Checkbox>
          </VStack>
        }
        isRenamingFile={!selectedObjs()[0].is_dir}
        opened={isOpen()}
        onClose={onClose}
        defaultValue={selectedObjs()[0]?.name ?? ""}
        loading={loading()}
        onSubmit={async (name) => {
          const dir = pathname()
          const old = selectedObjs()[0].name
          const replaced = overwrite()
          const seed = followSeed()
          const resp = await ok(pathJoin(dir, old), name, replaced, seed)
          handleResp(resp, () => {
            refresh()
            onClose()
            // a rename that replaced a file cannot be taken back: that file is gone
            if (replaced) notify.success(resp.message)
            else
              offerUndo({
                message: t("files.renamed_to", { name }),
                undo: () => fsRename(pathJoin(dir, name), old, false, seed),
                refresh: () => void refresh(),
              })
          })
        }}
      />
    </Show>
  )
}
