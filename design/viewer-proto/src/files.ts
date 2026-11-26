// The data side of the prototype: the real fs API of the CI OpenList through
// src/utils, nothing mocked.
import naturalSort from "typescript-natural-sort"
import { ObjType, type Obj } from "~/types"
import { api, encodePath, fsGet, fsList, pathJoin } from "~/utils"

export type Kind =
  "folder" | "video" | "image" | "pdf" | "text" | "audio" | "other"

export const extOf = (name: string) => {
  const i = name.lastIndexOf(".")
  return i < 0 ? "" : name.slice(i + 1).toLowerCase()
}

export const kindOf = (obj: Pick<Obj, "is_dir" | "type" | "name">): Kind => {
  if (obj.is_dir) return "folder"
  if (extOf(obj.name) === "pdf") return "pdf"
  switch (obj.type) {
    case ObjType.VIDEO:
      return "video"
    case ObjType.IMAGE:
      return "image"
    case ObjType.TEXT:
      return "text"
    case ObjType.AUDIO:
      return "audio"
  }
  return "other"
}

/** Which kinds open where: the dock, the overlay viewer, or the small dialog. */
export const opensIn = (k: Kind): "dock" | "overlay" | "dialog" | "folder" =>
  k === "folder"
    ? "folder"
    : k === "video"
      ? "dock"
      : k === "other"
        ? "dialog"
        : "overlay"

export interface Entry extends Obj {
  path: string
  kind: Kind
}

export interface Dir {
  path: string
  entries: Entry[]
  provider: string
}

export const parentOf = (path: string) =>
  path.slice(0, path.lastIndexOf("/")) || "/"

export const normalize = (path: string) => {
  let p = decodeURIComponent(path).replace(/\/{2,}/g, "/")
  if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1)
  return p.startsWith("/") ? p : "/" + p
}

/** A directory, folders first, then names in natural order (the app's default). */
export const loadDir = async (path: string): Promise<Dir> => {
  const resp = await fsList(path)
  if (resp.code !== 200)
    throw Object.assign(new Error(`${path}: ${resp.code} ${resp.message}`), {
      code: resp.code,
    })
  const entries = (resp.data.content ?? [])
    .map((o) => ({ ...o, path: pathJoin(path, o.name), kind: kindOf(o) }))
    .sort((a, b) =>
      a.is_dir !== b.is_dir ? (a.is_dir ? -1 : 1) : naturalSort(a.name, b.name),
    )
  return { path, entries, provider: resp.data.provider }
}

/** Whether `path` is a folder (a deep link may name either). */
export const statPath = async (path: string) => {
  const resp = await fsGet(path)
  if (resp.code !== 200)
    throw new Error(`${path}: ${resp.code} ${resp.message}`)
  return resp.data
}

/** The direct link of a file, as useLink's getLinkByDirAndObj builds it. */
export const linkOf = (e: Pick<Entry, "path" | "sign">) =>
  `${api}/d${encodePath(e.path)}${e.sign ? `?sign=${e.sign}` : ""}`

/**
 * A download from one click, in this tab: an <a download> to the same origin
 * saves the response whatever its type, and opens no tab (03 §八.1).
 */
export const download = (e: Pick<Entry, "path" | "sign" | "name">) => {
  const a = document.createElement("a")
  a.href = linkOf(e)
  a.download = e.name
  a.rel = "noopener"
  a.style.display = "none"
  document.body.append(a)
  a.click()
  a.remove()
}

/** The external-player link of a file (the templates of src/utils/players.ts). */
export const externalHref = (scheme: string, url: string, name: string) =>
  scheme
    .replace("$durl", url)
    .replace("$edurl", encodeURIComponent(url))
    .replace(
      "$b64url",
      btoa(String.fromCharCode(...new TextEncoder().encode(url))),
    )
    .replace("$name", encodeURIComponent(name))

export const copyText = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
