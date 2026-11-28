import { useFetch, usePath, useRouter, useT } from "~/hooks"
import {
  bus,
  fsRemoveEmptyDirectory,
  handleRespWithNotifySuccess,
} from "~/utils"
import { onCleanup } from "solid-js"
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  createDisclosure,
} from "~/components/overlay"
import { Button } from "~/components/ui/button"

export const RemoveEmptyDirectory = () => {
  const { isOpen, onOpen, onClose } = createDisclosure()
  const { pathname } = useRouter()
  const [loading, ok] = useFetch(fsRemoveEmptyDirectory)
  const { refresh } = usePath()
  const handler = (name: string) => {
    if (name === "removeEmptyDirectory") {
      onOpen()
    }
  }
  bus.on("tool", handler)
  onCleanup(() => {
    bus.off("tool", handler)
  })
  const t = useT()
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
        <ModalHeader>{t("home.toolbar.remove_empty_directory")}</ModalHeader>
        <ModalBody>
          <p>{t("home.toolbar.remove_empty_directory-tips")}</p>
        </ModalBody>
        <ModalFooter display="flex" gap="$2">
          <Button variant="secondary" onClick={onClose}>
            {t("global.cancel")}
          </Button>
          <Button
            variant="destructive"
            loading={loading()}
            onClick={async () => {
              const resp = await ok(pathname())
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
