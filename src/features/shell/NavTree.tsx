import { createEffect, createSignal } from "solid-js"
import { FolderTree, type FolderTreeHandler } from "~/components/FolderTree"
import { useRouter } from "~/hooks"
import { encodePath } from "~/utils"

/**
 * The Files entry of the side nav, expanded into the folder tree: lazy (a
 * folder is listed when it opens), the current folder tinted. It is the
 * shared FolderTree in its nav look; the root row is the Files entry itself.
 */
export const NavTree = (props: { label: string }) => {
  const { pathname, to } = useRouter()
  const [handler, setHandler] = createSignal<FolderTreeHandler>()
  createEffect(() => handler()?.setPath(pathname()))
  return (
    <FolderTree
      variant="nav"
      rootLabel={props.label}
      autoOpen
      showEmptyIcon
      showHiddenFolder={false}
      onChange={(path) => to(encodePath(path))}
      handle={setHandler}
    />
  )
}
