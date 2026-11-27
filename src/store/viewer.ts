// A file opens over its folder (docs/PLAN_FE_SYSTEM_UX_1127.md §0.2 URL): the
// address names the file, the page stays the folder's. Everything that reads
// the router's pathname as "the folder on screen" (99 places: breadcrumb,
// toolbar, links, uploads) keeps doing so, because pathname gives the folder
// while the address names one of its files; the viewers read viewerPath.
import { createMemo, createRoot, createSignal } from "solid-js"
import type { Obj } from "~/types"
import { objStore } from "./obj"

/** The file the address names while a viewer shows it; unset for a folder. */
const [viewerPath, setViewerPath] = createSignal<string>()
export { viewerPath, setViewerPath }

/**
 * A share of one file: its root (/@s/<id>) is the file itself, shown as a
 * folder of one. Its links have no name below the share root (useLink).
 */
export const [singleFileShare, setSingleFileShare] = createSignal(false)

/**
 * What fs/get said about a file the address named on arrival (a link, a
 * refresh): handed from usePath to the viewer, which opens it once its folder
 * is listed.
 */
export const [addressFile, setAddressFile] = createSignal<{
  path: string
  obj: Obj
}>()

/**
 * objStore.obj, raw_url and related describe the file in a viewer (the
 * previews read them there), not the folder: a listing leaves them alone.
 */
export const [fileShown, setFileShown] = createSignal(false)

/** "/a/b.txt" -> "/a"; "/b.txt" -> "/". */
export const parentOf = (path: string) =>
  path.slice(0, path.replace(/\/+$/, "").lastIndexOf("/")) || "/"
const nameOf = (path: string) => path.replace(/\/+$/, "").split("/").pop()!

const listedFiles = createRoot(() =>
  createMemo(
    () => new Set(objStore.objs.filter((o) => !o.is_dir).map((o) => o.name)),
  ),
)

/** Whether `path` is a file of the folder on screen: it opens over that folder. */
export const isListedFile = (path: string) =>
  !!objStore.listed &&
  parentOf(path) === objStore.listed &&
  listedFiles().has(nameOf(path))

/** The page a path is: the folder of a file shown over it, else the path. */
export const pageOf = (path: string) =>
  !singleFileShare() && (path === viewerPath() || isListedFile(path))
    ? parentOf(path)
    : path
