// What is open over the folder, and the address that says so (plan §0.2 URL;
// the prototype's design/viewer-proto/src/state.ts, run 45866187867):
//   - opening a file from the list pushes its /<dir>/<file> address;
//   - moving inside a viewer (previous/next, another video while the dock
//     plays) replaces it;
//   - one Back closes, and the folder comes back at the scroll it had;
//   - a link or a refresh lists the folder first, then opens the file
//     (usePath hands the file over through addressFile);
//   - closing a file that was linked to replaces its address with the folder's.
// The viewers follow the address: every change goes through apply(), whether
// it came from a click, Back/Forward or the first load (ViewerHost).
import { batch, createSignal } from "solid-js"
import {
  addressFile,
  clearHistory,
  objStore,
  parentOf,
  setViewerPath,
  singleFileShare,
  viewerPath,
} from "~/store"
import { Obj, ObjType } from "~/types"
import { encodePath, ext, joinBase, pathJoin } from "~/utils"

export type Where = "dock" | "image" | "doc" | "dialog"

/** The video in the docked player; it stays while an image or a document opens over it. */
const [dockPath, setDockPath] = createSignal<string>()
/** The image or document in the overlay viewer, and the preview it was asked with. */
const [overlay, setOverlay] = createSignal<{
  path: string
  kind: "image" | "doc"
  preview?: string
}>()
/** A file nothing previews (or one whose site downloads by default): the small dialog. */
const [dialogPath, setDialogPath] = createSignal<string>()
/**
 * The file whose fs/get answer is in objStore (obj, raw_url, related): the
 * previews inside the viewers read it there. Set by ViewerHost.
 */
const [loaded, setLoaded] = createSignal<string>()
/**
 * A share of one file is its own folder: closing the file keeps its address,
 * so this says the file there was closed (until the address changes or the
 * file is opened again).
 */
const [dismissed, setDismissed] = createSignal<string>()
export {
  dockPath,
  overlay,
  dialogPath,
  loaded,
  setLoaded,
  dismissed,
  setDismissed,
}

const nameOf = (path: string) => path.replace(/\/+$/, "").split("/").pop()!

/** The file at `path`: its row in the listing, or what fs/get said on arrival. */
export const entryOf = (path: string | undefined): Obj | undefined => {
  if (!path) return undefined
  const fromAddress = addressFile()
  if (singleFileShare() && fromAddress?.path === path) return fromAddress.obj
  if (parentOf(path) === objStore.listed) {
    const name = nameOf(path)
    const row = objStore.objs.find((o) => !o.is_dir && o.name === name)
    if (row) return row
  }
  return fromAddress?.path === path ? fromAddress.obj : undefined
}

/** The folder the open files belong to (a single-file share is its own). */
export const folderOf = (path: string) =>
  singleFileShare() ? path : parentOf(path)

const HEIF = new Set(["heic", "heif", "avif", "vvc", "avc"])
/** Images the browser draws itself; HEIF goes to the image preview (libheif). */
export const drawable = (obj: Obj) =>
  obj.type === ObjType.IMAGE && !HEIF.has(ext(obj.name).toLowerCase())

/**
 * Where a file opens, from the previews it has (previews/index.ts). The site's
 * "download by default" puts the download first: then it is the dialog, with
 * the previews under "Open with", as the download page had them.
 */
export const whereOf = (
  obj: Obj,
  previews: { key: string }[],
  preview?: string,
): Where => {
  if (
    preview &&
    preview !== "download" &&
    previews.some((p) => p.key === preview)
  )
    return preview === "movi_video" ? "dock" : "doc"
  if (!previews.length || previews[0].key === "download") return "dialog"
  if (
    obj.type === ObjType.VIDEO &&
    previews.some((p) => p.key === "movi_video")
  )
    return "dock"
  if (drawable(obj)) return "image"
  return "doc"
}

/** The path the address names now, of whatever shows on top. */
export const current = () => overlay()?.path ?? dialogPath() ?? dockPath()

/**
 * Puts the viewers in the state the address names: `path` the file it names,
 * undefined for the folder itself. `where` is decided by the caller, which has
 * the router context the previews need.
 */
export const apply = (
  path: string | undefined,
  where?: Where,
  preview?: string,
) => {
  batch(() => {
    if (!path || !where) {
      setOverlay(undefined)
      setDialogPath(undefined)
      setDockPath(undefined)
      setViewerPath(undefined)
      return
    }
    setViewerPath(path)
    setOverlay(
      where === "image" || where === "doc"
        ? { path, kind: where, preview }
        : undefined,
    )
    setDialogPath(where === "dialog" ? path : undefined)
    if (where === "dock") setDockPath(path)
  })
}

// ---- navigation: the router of the page, bound by ViewerHost
interface Nav {
  navigate: (
    to: string,
    o: { replace?: boolean; scroll?: boolean; state?: unknown },
  ) => void
  search: () => string
}
let nav: Nav | undefined
export const bindNav = (n: Nav | undefined) => (nav = n)

/** The element a viewer opens from and closes back to (FLIP origin). */
let originEl: Element | undefined
export const takeOrigin = () => {
  const el = originEl
  originEl = undefined
  return el
}

let keepScroll = false
/**
 * Scroll the folder had before the open that this Back undoes, read when the
 * viewer closes: by then the history is on the folder's entry, which openPath
 * stamped with it (Forward then Back finds it again). An entry reached
 * otherwise has none. Read here rather than on popstate, so it does not hang
 * on which popstate listener runs first.
 */
export const takeRestore = () => {
  const keep = keepScroll
  keepScroll = false
  return keep ? undefined : (history.state?.scrollY as number | undefined)
}

const hrefOf = (path: string, preview?: string) => {
  // the folder's own query (its page) stays on the file's address; a preview
  // choice belongs to the file it was made for
  const q = new URLSearchParams(nav?.search() ?? "")
  q.delete("preview")
  if (preview) q.set("preview", preview)
  const s = q.toString()
  return joinBase(encodePath(path, true)) + (s ? `?${s}` : "")
}

/**
 * Opens a file of the folder on screen. From the list it pushes, except a
 * video while the dock already plays one: that is switching inside the
 * player, so it replaces, as previous/next do (`replace`).
 */
export const openPath = (
  path: string,
  opts: {
    from?: Element
    replace?: boolean
    video?: boolean
    preview?: string
  } = {},
) => {
  if (!nav) return
  originEl = opts.from
  const switching =
    opts.replace ||
    (opts.video &&
      !opts.preview &&
      dockPath() !== undefined &&
      !overlay() &&
      !dialogPath())
  const href = hrefOf(path, opts.preview)
  if (switching) {
    nav.navigate(href, { replace: true, scroll: false, state: history.state })
    return
  }
  history.replaceState({ ...history.state, scrollY: window.scrollY }, "")
  nav.navigate(href, { scroll: false, state: { opened: true } })
}

/** Shows the open file with another of its previews (the viewers' Open with). */
export const openWith = (path: string, preview: string) =>
  openPath(path, { replace: true, preview })

/**
 * What a click on a row of the list does: a folder is entered (a new page), a
 * file opens over the folder. `from` is the row, for the viewers that grow
 * out of it.
 */
export const openListed = (obj: Obj, from?: Element, preview?: string) => {
  if (!nav) return
  if (singleFileShare()) {
    // the one file of the share, at the share's own address
    originEl = from
    setDismissed(undefined)
    return
  }
  const path = pathJoin(objStore.listed || "/", obj.name)
  if (obj.is_dir) {
    // as useRouter's to(): the folder is read afresh, not from the back cache
    clearHistory(path)
    nav.navigate(joinBase(encodePath(path)), {})
    return
  }
  openPath(path, { from, video: obj.type === ObjType.VIDEO, preview })
}

/** The row of a file in the list, whatever the layout. */
export const rowOf = (name: string) =>
  document.querySelector(`[data-row-name="${CSS.escape(name)}"]`) ?? undefined

/**
 * Closes what the address shows: Back when this entry came from an open, so
 * the history does not keep a closed viewer; otherwise (a link) the address is
 * replaced by the folder's. `keep`: the user closed the mini player while
 * reading further down the list, so the list stays where it is.
 */
export const closeCurrent = (keep = false) => {
  const path = current()
  if (!path || !nav) return
  if (history.state?.opened) {
    keepScroll = keep
    history.back()
    return
  }
  // what is under the closed one: the docked video when an image closes over it
  const under =
    (overlay() || dialogPath()) && dockPath() ? dockPath()! : folderOf(path)
  // a single-file share is its own folder: the address stays, the file closes
  if (under === path) {
    setDismissed(path)
    apply(undefined)
    return
  }
  const state = { ...history.state }
  delete state.opened
  delete state.scrollY
  nav.navigate(hrefOf(under), { replace: true, scroll: false, state })
}

/** The neighbour of `path` among the folder's files that open the same way. */
export const sibling = (
  path: string,
  step: 1 | -1,
  same: (o: Obj) => boolean,
) => {
  const name = nameOf(path)
  const files = objStore.objs.filter((o) => !o.is_dir && same(o))
  const i = files.findIndex((o) => o.name === name)
  return i < 0 ? undefined : files[i + step]
}

/** Moves the viewer showing `path` to its neighbour, replacing the address. */
export const step = (path: string, by: 1 | -1, same: (o: Obj) => boolean) => {
  const n = sibling(path, by, same)
  if (n) openPath(pathJoin(folderOf(path), n.name), { replace: true })
  return !!n
}

export { viewerPath }
