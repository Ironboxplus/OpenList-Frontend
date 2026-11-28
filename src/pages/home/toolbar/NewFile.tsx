import { createSignal, onCleanup } from "solid-js"
import { ModalInput } from "~/components"
import { useFetch, usePath, useRouter, useT } from "~/hooks"
import { password } from "~/store"
import { bus, fsNewFile, handleRespWithNotifySuccess, pathJoin } from "~/utils"
import { createDisclosure } from "~/components/overlay"
import { CheckboxField } from "~/components/ui/toggle-field"

export const NewFile = () => {
  const t = useT()
  const { isOpen, onOpen, onClose } = createDisclosure()
  const [loading, ok] = useFetch(fsNewFile)
  const { refresh } = usePath()
  const { pathname } = useRouter()
  const [overwrite, setOverwrite] = createSignal(false)
  const handler = (name: string) => {
    if (name === "new_file") {
      onOpen()
      setOverwrite(false)
    }
  }
  bus.on("tool", handler)
  onCleanup(() => {
    bus.off("tool", handler)
  })
  return (
    <ModalInput
      title="home.toolbar.input_filename"
      validateFilename={true}
      footerSlot={
        <CheckboxField
          class="mr-auto"
          checked={overwrite()}
          onChange={() => {
            setOverwrite(!overwrite())
          }}
        >
          {t("home.conflict_policy.overwrite_existing")}
        </CheckboxField>
      }
      opened={isOpen()}
      onClose={onClose}
      loading={loading()}
      onSubmit={async (name) => {
        const resp = await ok(
          pathJoin(pathname(), name),
          password(),
          overwrite(),
        )
        handleRespWithNotifySuccess(resp, () => {
          refresh()
          onClose()
        })
      }}
    />
  )
}
