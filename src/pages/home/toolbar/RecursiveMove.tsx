import { ModalFolderChoose } from "~/components"
import { useFetch, usePath, useRouter, useT } from "~/hooks"
import { bus, fsRecursiveMove, handleRespWithNotifySuccess } from "~/utils"
import { createSignal, onCleanup } from "solid-js"
import { CreateFolderButton } from "./CopyMove"
import {
  createDisclosure,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
} from "~/components/overlay"
import { Button } from "~/components/ui/button"
import { SimpleSelect } from "~/components/ui/simple-select"

export const RecursiveMove = () => {
  const {
    isOpen: isConfirmModalOpen,
    onOpen: openConfirmModal,
    onClose: closeConfirmModal,
  } = createDisclosure()
  const { isOpen, onOpen, onClose } = createDisclosure()
  const [loading, ok] = useFetch(fsRecursiveMove)
  const { pathname } = useRouter()
  const { refresh } = usePath()
  const [conflictPolicy, setConflictPolicy] = createSignal("cancel")
  const handler = (name: string) => {
    if (name === "recursiveMove") {
      openConfirmModal()
      setConflictPolicy("cancel")
    }
  }
  bus.on("tool", handler)
  onCleanup(() => {
    bus.off("tool", handler)
  })
  const t = useT()
  return (
    <>
      <Modal
        blockScrollOnMount={false}
        opened={isConfirmModalOpen()}
        onClose={() => closeConfirmModal()}
        size={{
          "@initial": "xs",
          "@md": "md",
        }}
      >
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>{t("home.toolbar.recursive_move")}</ModalHeader>
          <ModalBody>
            <p>{t("home.toolbar.recursive_move_directory-tips")}</p>
          </ModalBody>
          <ModalFooter class="flex gap-2">
            <Button variant="secondary" onClick={() => closeConfirmModal()}>
              {t("global.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                closeConfirmModal()
                onOpen()
              }}
            >
              {t("global.confirm")}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <ModalFolderChoose
        header={t("home.toolbar.choose_dst_folder")}
        opened={isOpen()}
        onClose={onClose}
        loading={loading()}
        headerSlot={(handler) => <CreateFolderButton handler={handler} />}
        footerSlot={
          <div class="mr-auto flex flex-[0.8] items-center gap-x-1">
            <SimpleSelect
              value={conflictPolicy()}
              onChange={setConflictPolicy}
              options={[
                {
                  value: "cancel",
                  label: t("home.conflict_policy.cancel_if_exists"),
                },
                {
                  value: "overwrite",
                  label: t("home.conflict_policy.overwrite_existing"),
                },
                {
                  value: "skip",
                  label: t("home.conflict_policy.skip_existing"),
                },
              ]}
            />
          </div>
        }
        onSubmit={async (dst) => {
          const resp = await ok(pathname(), dst, conflictPolicy())
          handleRespWithNotifySuccess(resp, () => {
            refresh()
            onClose()
          })
        }}
      />
    </>
  )
}
