// What is open, and the URL that says so (DESIGN_FE_VIEWER_PROTO_1127 §0,
// 后退和 URL; research 03 §七.2):
//   - opening a file from the list pushes its existing /<dir>/<file> path;
//   - moving inside a viewer (previous/next, another video while the dock
//     plays) replaces it;
//   - one Back closes, and the directory comes back at the scroll it had;
//   - a refresh or a pasted file link renders the parent directory first and
//     then opens the file.
// The page state always follows the URL: every change goes through apply(),
// whether it came from a click, Back/Forward or the first load.
import { batch, createSignal } from "solid-js"
import {
  loadDir,
  normalize,
  opensIn,
  parentOf,
  statPath,
  type Dir,
  type Entry,
} from "./files"

export const HOME = "/审计/查看器"

const [dir, setDir] = createSignal<Dir>()
const [loadError, setLoadError] = createSignal("")
/** The video in the docked player; it stays while images open over it. */
const [dockPath, setDockPath] = createSignal<string | null>(null)
/** The image, PDF, text or audio in the overlay viewer. */
const [overlayPath, setOverlayPath] = createSignal<string | null>(null)
/** A file of a type without a viewer: the small download dialog. */
const [dialogPath, setDialogPath] = createSignal<string | null>(null)
const [selected, setSelected] = createSignal<ReadonlySet<string>>(new Set())
const [shareFor, setShareFor] = createSignal<Entry[] | null>(null)

export {
  dir,
  loadError,
  dockPath,
  overlayPath,
  dialogPath,
  selected,
  setSelected,
  shareFor,
  setShareFor,
}

/** The element a viewer opens from and closes back to (FLIP origin). */
let originEl: Element | undefined
export const takeOrigin = () => {
  const el = originEl
  originEl = undefined
  return el
}

export const entryAt = (path: string | null | undefined) =>
  path ? dir()?.entries.find((e) => e.path === path) : undefined

interface PageState {
  proto: true
  /** This entry was pushed by opening a file, so Back closes it. */
  opened?: boolean
  /** The directory's scroll when a file was opened from it. */
  scrollY?: number
}

const state = (): PageState | null =>
  history.state && history.state.proto ? (history.state as PageState) : null

const href = (path: string) => encodeURI(path)
const currentPath = () => normalize(location.pathname)

const showDir = async (path: string) => {
  if (dir()?.path === path) return
  try {
    const d = await loadDir(path)
    batch(() => {
      setDir(d)
      setSelected(new Set<string>())
      setLoadError("")
    })
  } catch (e) {
    setLoadError(String((e as Error)?.message ?? e))
  }
}

/** Puts the page in the state the URL names. The directory is always first. */
const apply = async (path: string) => {
  const d = dir()
  const inDir = d && (path === d.path || parentOf(path) === d.path)
  if (!inDir) {
    // a folder, or a file of another folder (a deep link, Back across folders)
    const obj = path === "/" ? null : await statPath(path).catch(() => null)
    const folder = !obj || obj.is_dir ? path : parentOf(path)
    batch(() => {
      setDockPath(null)
      setOverlayPath(null)
      setDialogPath(null)
    })
    await showDir(folder)
    if (folder === path) return
  }
  const e = entryAt(path)
  batch(() => {
    if (!e || e.kind === "folder") {
      setOverlayPath(null)
      setDialogPath(null)
      setDockPath(null)
      return
    }
    const where = opensIn(e.kind)
    setOverlayPath(where === "overlay" ? e.path : null)
    setDialogPath(where === "dialog" ? e.path : null)
    if (where === "dock") setDockPath(e.path)
  })
}

/** Scroll the directory had before the open that this Back undoes. */
let restoreTo: number | undefined
export const takeRestore = () => {
  const y = restoreTo
  restoreTo = undefined
  return y
}
let keepScroll = false

export const boot = async () => {
  history.scrollRestoration = "manual"
  window.addEventListener("popstate", () => {
    const s = state()
    restoreTo = keepScroll ? undefined : s?.scrollY
    keepScroll = false
    // the dock takes the scroll itself when it is what closed (Dock.tsx); any
    // other close leaves it here
    void apply(currentPath()).then(() => {
      const y = takeRestore()
      if (y !== undefined) window.scrollTo(0, y)
    })
  })
  let path = currentPath()
  if (path === "/") {
    path = HOME
    history.replaceState({ proto: true } satisfies PageState, "", href(path))
  }
  await apply(path)
}

/** A folder: pushed like any navigation. */
export const goDir = (path: string) => {
  history.replaceState({ ...state(), proto: true, scrollY: window.scrollY }, "")
  history.pushState({ proto: true } satisfies PageState, "", href(path))
  void apply(path).then(() => window.scrollTo(0, 0))
}

/**
 * Opens a file. From the list it pushes, except a video while the dock already
 * plays one: that is switching inside the player, so it replaces, as
 * previous/next do (`replace`).
 */
export const openEntry = (
  e: Entry,
  how: "list" | "replace",
  from?: Element,
) => {
  if (e.kind === "folder") return goDir(e.path)
  originEl = from
  const switching =
    how === "replace" ||
    (opensIn(e.kind) === "dock" &&
      dockPath() !== null &&
      overlayPath() === null)
  if (switching) {
    history.replaceState({ ...state(), proto: true }, "", href(e.path))
  } else {
    history.replaceState(
      { ...state(), proto: true, scrollY: window.scrollY },
      "",
    )
    history.pushState(
      { proto: true, opened: true } satisfies PageState,
      "",
      href(e.path),
    )
  }
  void apply(e.path)
}

/**
 * Closes what the URL shows: Back when this entry came from an open, so the
 * history does not keep a closed viewer; otherwise (a deep link) the URL is
 * replaced by the directory's. `keep`: the user closed the mini player while
 * reading further down the list, so the list stays where it is.
 */
export const closeCurrent = (keep = false) => {
  const d = dir()
  if (!d) return
  if (state()?.opened) {
    keepScroll = keep
    history.back()
    return
  }
  // what is under the closed one: the docked video when an image closes over it
  const under = overlayPath() || dialogPath() ? (dockPath() ?? d.path) : d.path
  history.replaceState({ ...state(), proto: true }, "", href(under))
  void apply(under)
}

/** The neighbour of `path` among the files of the same kind, in list order. */
export const sibling = (path: string, step: 1 | -1) => {
  const e = entryAt(path)
  if (!e) return undefined
  const same = dir()!.entries.filter((x) => x.kind === e.kind)
  return same[same.indexOf(e) + step]
}

export const toggleSelected = (path: string) => {
  const next = new Set(selected())
  if (next.has(path)) next.delete(path)
  else next.add(path)
  setSelected(next)
}
