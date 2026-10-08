import { createMemo } from "solid-js"
import { useRouter } from "~/hooks"
import { objStore, State, userCan } from "~/store"
import { bus } from "~/utils/bus"

/** The permission checks the old floating toolbar made, in one place. */
export const useFileAbilities = () => {
  const { isShare } = useRouter()
  const folder = createMemo(
    () => objStore.state === State.Folder && !isShare() && objStore.write,
  )
  const writeContent = () =>
    userCan("write_content") || objStore.write_content_bypass
  return {
    /** New folder / new file / upload. */
    create: createMemo(() => folder() && !!writeContent()),
    offline: createMemo(() => folder() && userCan("offline_download")),
    move: createMemo(() => folder() && userCan("move")),
    remove: createMemo(() => folder() && userCan("delete")),
    rename: createMemo(() => folder() && userCan("rename")),
    copy: createMemo(() => folder() && userCan("copy")),
    decompress: createMemo(() => folder() && userCan("decompress")),
    share: createMemo(() => !isShare() && userCan("share")),
    isShare,
  }
}

export type ToolName =
  | "upload"
  | "mkdir"
  | "new_file"
  | "offline_download"
  | "local_settings"
  | "recursiveMove"
  | "removeEmptyDirectory"
  | "batchRename"
  | "rename"
  | "move"
  | "copy"
  | "delete"
  | "decompress"
  | "share"
  | "package_download"
  | "search"

export const runTool = (name: ToolName) => bus.emit("tool", name)
