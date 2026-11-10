import { createSignal } from "solid-js"
import { encodePath } from "~/utils"
import { activeNavId } from "./nav-items"

/** Where the user was in the files section: a folder and how far it was scrolled. */
export interface FilesSpot {
  path: string
  scroll: number
}

type KV = Pick<Storage, "getItem" | "setItem" | "removeItem">
export const SPOT_KEY = "files-last-spot"

export const readSpot = (s: KV): FilesSpot | undefined => {
  try {
    const v = JSON.parse(s.getItem(SPOT_KEY) ?? "null")
    if (
      v &&
      typeof v.path === "string" &&
      v.path.startsWith("/") &&
      Number.isFinite(v.scroll)
    ) {
      return { path: v.path, scroll: Math.max(0, v.scroll) }
    }
  } catch {
    // unreadable: as if nothing was remembered
  }
  return undefined
}

export const writeSpot = (s: KV, spot: FilesSpot | undefined) => {
  try {
    if (spot) s.setItem(SPOT_KEY, JSON.stringify(spot))
    else s.removeItem(SPOT_KEY)
  } catch {
    // storage unavailable: the spot just lives in memory
  }
}

/**
 * Where a link to a section's path really goes. Files from another section
 * returns to the remembered folder; inside the files section it is the root,
 * and every other path is itself.
 */
export const resolveNavPath = (
  path: string,
  current: string,
  spot: FilesSpot | undefined,
): string => {
  if (path !== "/" || !spot || activeNavId(current) === "files") return path
  return encodePath(spot.path)
}

const [spot, setSpot] = createSignal(readSpot(sessionStorage))
let restoreIntent = false

const update = (next: FilesSpot | undefined) => {
  setSpot(next)
  writeSpot(sessionStorage, next)
}

/** The user is now looking at folder `path`; its scroll starts over unless it is the same one. */
export const rememberFolder = (path: string) => {
  const s = spot()
  if (s?.path === path) return
  update({ path, scroll: 0 })
}

export const rememberScroll = (path: string, scroll: number) => {
  if (spot()?.path === path) update({ path, scroll })
}

export const forgetSpot = () => update(undefined)

export const currentSpot = () => spot()

/** Resolve a nav link at click time; going back to the spot is then restored. */
export const goingTo = (path: string, current: string): string => {
  const target = resolveNavPath(path, current, spot())
  restoreIntent = path === "/" && !!spot() && activeNavId(current) !== "files"
  return target
}

/** Whether the files page was just entered through a nav link; read once. */
export const takeRestoreIntent = (): boolean => {
  const v = restoreIntent
  restoreIntent = false
  return v
}
