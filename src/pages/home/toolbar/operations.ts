import { IconTypes } from "solid-icons"
import { TiDeleteOutline } from "solid-icons/ti"
import { CgRename, CgShare } from "solid-icons/cg"
import { TbArchive, TbFileArrowRight } from "solid-icons/tb"
import { TbCopy, TbLink } from "solid-icons/tb"
import { AiTwotoneDelete } from "solid-icons/ai"
import { CgFileAdd, CgFolderAdd, CgFolderRemove } from "solid-icons/cg"
import { AiOutlineCloudDownload } from "solid-icons/ai"
import { ImMoveUp } from "solid-icons/im"
import { BiRegularRename } from "solid-icons/bi"
import { FaSolidMagnet, FaSolidSeedling } from "solid-icons/fa"
import { FiExternalLink } from "solid-icons/fi"
import {
  TbDownload,
  TbEdit,
  TbExternalLink,
  TbShare,
  TbTrash,
} from "solid-icons/tb"
import {
  runTool,
  useFileAbilities,
  type ToolName,
} from "~/features/files/file-actions"
import { useDownload } from "~/hooks"
import { downloadDenied, selectedObjs } from "~/store"
import { openListed } from "~/features/viewer/state"

export interface Operations {
  [key: string]: {
    icon: IconTypes
    /** A Tailwind text colour class. */
    color?: string
    p?: boolean
  }
}
export const operations: Operations = {
  open_with: { icon: FiExternalLink, color: "text-primary" },
  rename: { icon: CgRename, color: "text-primary" },
  copy: { icon: TbCopy, color: "text-success" },
  move: { icon: TbFileArrowRight, color: "text-warning" },
  delete: { icon: AiTwotoneDelete, color: "text-destructive" },
  decompress: { icon: TbArchive, color: "text-muted-foreground" },
  copy_link: { icon: TbLink, color: "text-primary" },
  mkdir: { icon: CgFolderAdd, p: true },
  recursive_move: { icon: ImMoveUp, p: true },
  remove_empty_directory: { icon: CgFolderRemove, p: true },
  batch_rename: { icon: BiRegularRename, p: true },
  new_file: { icon: CgFileAdd, p: true },
  cancel_select: { icon: TiDeleteOutline },
  download: { icon: AiOutlineCloudDownload, color: "text-primary" },
  share: { icon: CgShare, color: "text-primary" },
  offline_download_torrent: { icon: FaSolidMagnet, color: "text-primary" },
  generate_transfer_seed: { icon: FaSolidSeedling, color: "text-success" },
}
/** One action on the current selection. */
export interface FileOperation {
  /** The i18n key suffix (`home.toolbar.<name>`) and the test hook. */
  name: string
  icon: IconTypes
  danger?: boolean
  /** Whether it applies to the selection and the user may do it. */
  visible: () => boolean
  run: () => void
}

/**
 * The actions of the selection bar (top bar) and of the context menu: one
 * definition, so a permission rule or a behaviour is changed in one place. Each
 * `run` is the bus tool or hook the old toolbars used.
 */
export const useFileOperations = () => {
  const can = useFileAbilities()
  const { downloadObjs } = useDownload()
  const only = () =>
    selectedObjs().length === 1 ? selectedObjs()[0] : undefined
  const tool = (name: ToolName) => () => runTool(name)
  const operation = (op: FileOperation) => op
  const open = operation({
    name: "open",
    icon: TbExternalLink,
    visible: () => !!only(),
    run: () => {
      const obj = only()
      if (obj) openListed(obj)
    },
  })
  const download = operation({
    name: "download",
    icon: TbDownload,
    visible: () => !downloadDenied(),
    // one file saves in place; several, or folders, go as one package
    run: () => downloadObjs(selectedObjs()),
  })
  const copy = operation({
    name: "copy",
    icon: TbCopy,
    visible: () => !!can.copy(),
    run: tool("copy"),
  })
  const move = operation({
    name: "move",
    icon: TbFileArrowRight,
    visible: () => !!can.move(),
    run: tool("move"),
  })
  const rename = operation({
    name: "rename",
    icon: TbEdit,
    visible: () => !!can.rename(),
    run: tool("rename"),
  })
  const share = operation({
    name: "share",
    icon: TbShare,
    visible: can.share,
    run: tool("share"),
  })
  const del = operation({
    name: "delete",
    icon: TbTrash,
    danger: true,
    visible: () => !!can.remove(),
    run: tool("delete"),
  })
  return { open, download, copy, move, rename, share, delete: del }
}

export type FileOperations = ReturnType<typeof useFileOperations>
