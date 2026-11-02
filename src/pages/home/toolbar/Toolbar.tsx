import { Portal } from "solid-js/web"
import { Center } from "./Center"
import { Right } from "./Right"
import { Copy, Move } from "./CopyMove"
import { Delete } from "./Delete"
import { Rename } from "./Rename"
import { NewFile } from "./NewFile"
import { Mkdir } from "./Mkdir"
import { RecursiveMove } from "./RecursiveMove"
import { RemoveEmptyDirectory } from "./RemoveEmptyDirectory"
import { BatchRename } from "./BatchRename"
import {
  OfflineDownloadEnhanced,
  TransferSeedGenerator,
} from "./OfflineDownloadEnhanced"
import { PackageDownloadModal } from "./Download"
import { lazy, Show } from "solid-js"
import { shellActive } from "~/features/shell/topbar-slot"
import { ModalWrapper } from "./ModalWrapper"
import { LocalSettings } from "./LocalSettings"
import { BackTop } from "./BackTop"
import { Decompress } from "./Decompress"
import { Share } from "./Share"

const Upload = lazy(() => import("../uploads/Upload"))

export const Modal = () => {
  return (
    <>
      <Copy />
      <Move />
      <Rename />
      <Delete />
      <Decompress />
      <NewFile />
      <Mkdir />
      <Share />
      <RecursiveMove />
      <RemoveEmptyDirectory />
      <BatchRename />
      <OfflineDownloadEnhanced />
      <TransferSeedGenerator />
      <PackageDownloadModal />
      <ModalWrapper name="upload" title="home.toolbar.upload">
        <Upload />
      </ModalWrapper>
      <LocalSettings />
    </>
  )
}

export const Toolbar = () => {
  return (
    <Portal>
      {/* Inside the shell the action bar / phone FAB / batch bar replace the
          floating toolbars; guests keep them. */}
      <Show when={!shellActive()}>
        <Right />
        <Center />
      </Show>
      <Modal />
      <BackTop />
    </Portal>
  )
}
