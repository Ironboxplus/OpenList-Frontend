import { createSignal, lazy, onCleanup, Show, Suspense } from "solid-js"
import { FullLoading } from "~/components"
import { useT, useDownload } from "~/hooks"
import { getSettingBool, me } from "~/store"
import { UserMethods } from "~/types"
import { bus } from "~/utils"
import { CenterIcon } from "./Icon"
import {
  Menu,
  MenuTrigger,
  MenuContent,
  MenuItem,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  createDisclosure,
} from "~/components/overlay"
import { Button } from "~/components/ui/button"

export const Download = () => {
  const t = useT()
  const { batchDownloadSelected, sendToAria2, playlistDownloadSelected } =
    useDownload()
  return (
    <Menu placement="top" offset={10}>
      <MenuTrigger as={CenterIcon} name="download" />
      <MenuContent>
        <MenuItem onSelect={batchDownloadSelected}>
          {t("home.toolbar.batch_download")}
        </MenuItem>
        <Show
          when={
            UserMethods.is_admin(me()) || getSettingBool("package_download")
          }
        >
          <MenuItem
            onSelect={() => {
              bus.emit("tool", "package_download")
            }}
          >
            {t("home.toolbar.package_download")}
          </MenuItem>
          <MenuItem onSelect={playlistDownloadSelected}>
            {t("home.toolbar.playlist_download")}
          </MenuItem>
        </Show>
        <MenuItem onSelect={sendToAria2}>
          {t("home.toolbar.send_aria2")}
        </MenuItem>
      </MenuContent>
    </Menu>
  )
}

const PackageDownload = lazy(() => import("./PackageDownload"))

export const PackageDownloadModal = () => {
  const t = useT()
  const handler = (name: string) => {
    if (name === "package_download") {
      if (!getSettingBool("package_download")) return
      onOpen()
    }
  }
  bus.on("tool", handler)
  onCleanup(() => {
    bus.off("tool", handler)
  })
  const { isOpen, onOpen, onClose } = createDisclosure()
  const [show, setShow] = createSignal("pre_tips")
  return (
    <Modal
      blockScrollOnMount={false}
      opened={isOpen()}
      onClose={onClose}
      closeOnOverlayClick={false}
      closeOnEsc={false}
      // size={{
      //   "@initial": "xs",
      //   "@md": "md",
      // }}
    >
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{t("home.toolbar.package_download")}</ModalHeader>
        <Suspense fallback={<FullLoading />}>
          <Show
            when={show() === "pre_tips"}
            fallback={<PackageDownload onClose={onClose} />}
          >
            <ModalBody>
              <p>{t("home.toolbar.pre_package_download-tips")}</p>
            </ModalBody>
            <ModalFooter class="flex gap-2">
              <Button variant="secondary" onClick={onClose}>
                {t("global.cancel")}
              </Button>
              <Button
                variant="subtle"
                onClick={() => {
                  setShow("package_download")
                }}
              >
                {t("global.confirm")}
              </Button>
            </ModalFooter>
          </Show>
        </Suspense>
      </ModalContent>
    </Modal>
  )
}
