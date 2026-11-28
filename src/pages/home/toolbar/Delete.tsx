import { createSignal, onCleanup } from "solid-js"
import { useFetch, usePath, useRouter, useT } from "~/hooks"
import { selectedObjs } from "~/store"
import { bus, fsRemove, handleRespWithNotifySuccess } from "~/utils"
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  createDisclosure,
} from "~/components/overlay"
import { CheckboxField } from "~/components/ui/toggle-field"
import { Button } from "~/components/ui/button"

export const Delete = () => {
  const t = useT()
  const { isOpen, onOpen, onClose } = createDisclosure()
  const [loading, ok] = useFetch(fsRemove)
  const { refresh } = usePath()
  const { pathname } = useRouter()
  const [followSeed, setFollowSeed] = createSignal(false)
  const handler = (name: string) => {
    if (name === "delete") {
      setFollowSeed(false)
      onOpen()
    }
  }
  bus.on("tool", handler)
  onCleanup(() => {
    bus.off("tool", handler)
  })
  return (
    <Modal
      blockScrollOnMount={false}
      opened={isOpen()}
      onClose={onClose}
      size={{
        "@initial": "xs",
        "@md": "md",
      }}
    >
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{t("home.toolbar.delete")}</ModalHeader>
        <ModalBody>
          <p>{t("home.toolbar.delete-tips")}</p>
          <CheckboxField
            class="mt-2"
            checked={followSeed()}
            disabled={selectedObjs().some((obj) => obj.is_dir)}
            onChange={() => setFollowSeed(!followSeed())}
          >
            {t("home.toolbar.follow_seed")}
          </CheckboxField>
        </ModalBody>
        <ModalFooter display="flex" gap="$2">
          <Button variant="secondary" onClick={onClose}>
            {t("global.cancel")}
          </Button>
          <Button
            variant="destructive"
            loading={loading()}
            onClick={async () => {
              const resp = await ok(
                pathname(),
                selectedObjs().map((obj) => obj.name),
                followSeed(),
              )
              handleRespWithNotifySuccess(resp, () => {
                refresh()
                onClose()
              })
            }}
          >
            {t("global.confirm")}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
