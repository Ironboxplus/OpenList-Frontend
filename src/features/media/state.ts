// Shared state of the media view. This file is part of the main bundle (the
// view menu and the file rows read it), so it stays small and imports nothing
// heavy: the loader, the header, the poster wall and the editor live in a
// lazily loaded chunk and only write into these signals.
import { createMemo, createSignal } from "solid-js"
import { objStore } from "~/store"
import {
  cardsByName,
  episodeMap,
  preferPoster,
  readChoice,
  writeChoice,
  type ViewChoice,
} from "./logic"
import type { MediaFs } from "./types"

const [loaded, setLoaded] = createSignal<{ path: string; fs: MediaFs }>()

export const mediaFs = (): MediaFs | undefined => loaded()?.fs
export const mediaPath = (): string | undefined => loaded()?.path
export const setMediaFor = (path: string, fs: MediaFs | undefined) =>
  setLoaded(fs ? { path, fs } : undefined)

/** The backend answered for this directory: media entries (and the editor) make sense. */
export const mediaReady = () => loaded() !== undefined

const [rev, setRev] = createSignal(0)

/** Children that carry real media info (not `ignore`). */
const mediaChildren = createMemo(
  () => mediaFs()?.children.filter((c) => c.kind !== "ignore") ?? [],
)

export const hasPosterView = () => mediaChildren().length > 0

export const posterActive = (): boolean => {
  const path = mediaPath()
  if (!path || !hasPosterView()) return false
  rev()
  const saved = readChoice(localStorage, path)
  if (saved) return saved === "poster"
  const subdirs = objStore.objs.filter((o) => o.is_dir).length
  return preferPoster(mediaChildren().length, subdirs)
}

/** Remember the user's pick for this directory ("poster" or any other view). */
export const chooseView = (choice: ViewChoice) => {
  const path = mediaPath()
  if (!path) return
  writeChoice(localStorage, path, choice)
  setRev(rev() + 1)
}

export const cardFor = (name: string) => cardMap().get(name)
const cardMap = createMemo(() => cardsByName(mediaFs()?.children ?? []))

const episodes = createMemo(() => episodeMap(mediaFs()?.episodes ?? []))
/** "S01E03 · Title" for the file called `name`, if the backend knows it. */
export const episodeFor = (name: string) => episodes().get(name)

// ---- editor ----

const [editorPath, setEditorPath] = createSignal<string>()
export { editorPath }
export const openMediaEditor = (path: string) => setEditorPath(path)
export const closeMediaEditor = () => setEditorPath(undefined)

// ---- cache invalidation (the cache itself lives in the lazy chunk) ----

let invalidator: ((path?: string) => void) | undefined
export const setMediaInvalidator = (fn: typeof invalidator) => {
  invalidator = fn
}
/** The directory was refreshed or changed: forget what we know about it. */
export const invalidateMedia = (path?: string) => {
  invalidator?.(path)
  setTick((t) => t + 1)
}
/** Bumped by invalidateMedia so the loader asks again even if nothing else changed. */
const [tick, setTick] = createSignal(0)
export const mediaTick = tick
