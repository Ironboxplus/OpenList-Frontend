import { objStore, password, selectedObjs, State, me } from "~/store"
import { Obj, ArchiveObj } from "~/types"
import {
  base_path,
  api,
  buildMpvCommandFor,
  encodePath,
  isMpvMedia,
  notify,
  pathDir,
  pathJoin,
  standardizePath,
} from "~/utils"
import { useRouter, useT, useUtil } from "."
import { getShareToken, shareIdOf } from "~/utils/share-auth"

type URLType = "preview" | "direct" | "proxy"

// get download url by dir and obj
export const getLinkByDirAndObj = (
  dir: string,
  obj: Obj,
  type: URLType = "direct",
  isShare: boolean,
  encodeAll?: boolean,
  opts: { preview?: boolean } = {},
) => {
  const shareId = isShare ? shareIdOf(dir.endsWith("/") ? dir : dir + "/") : ""
  if (type !== "preview")
    dir = isShare
      ? dir.substring(3) /* remove /@s */
      : pathJoin(me().base_path, dir)

  dir = standardizePath(dir, true)
  let path = `${dir}/${obj.name}`
  path = encodePath(path, encodeAll)
  let host = api
  let prefix = isShare ? "/sd" : type === "direct" ? "/d" : "/p"
  if (type === "preview") {
    prefix = ""
    if (!api.startsWith(location.origin + base_path))
      host = location.origin + base_path
  }
  const { inner_path, archive, pass: archive_pass } = obj as ArchiveObj
  if (archive) {
    prefix = "/ae"
    path = `${dir}/${archive.name}`
    path = encodePath(path, encodeAll)
  }
  let QP = () => {
    QP = () => "&"
    return "?"
  }
  let ans = `${host}${prefix}${path}`
  if (type !== "preview" && !isShare && obj.sign) {
    ans += `${QP()}sign=${obj.sign}`
  }
  if (type !== "preview" && isShare) {
    // The share token, not the password: it is what the backend hands out for
    // links, and it does not leave the visitor's password in a URL.
    const token = getShareToken(shareId)
    if (token) {
      ans += `${QP()}auth=${encodeURIComponent(token)}`
    }
  }
  // A share can switch downloads off but keep previews: say which this is.
  if (type !== "preview" && isShare && opts.preview) {
    ans += `${QP()}preview=1`
  }
  if (archive) {
    let inner = `${inner_path}/${obj.name}`
    ans += `${QP()}inner=${encodePath(inner, encodeAll)}${archive_pass ? `&pass=${encodeURIComponent(archive_pass)}` : ""}`
  }
  return ans
}

/**
 * Where obj lives, given the page: on a file page the path is the file itself; a
 * single-file share ("/@s/<id>") is the file with no name below the share root.
 */
export const locateObj = (
  isFilePage: boolean,
  pathname: string,
  isShare: boolean,
  obj: Obj,
): { dir: string; obj: Obj } => {
  if (!isFilePage) return { dir: pathname, obj }
  const dir = pathDir(pathname)
  if (isShare && dir === "/@s") {
    return { dir: pathname, obj: { ...obj, name: "" } }
  }
  return { dir, obj }
}

// get download link by current state and pathname
export const useLink = () => {
  const { pathname, isShare } = useRouter()
  const locate = (obj: Obj) =>
    locateObj(objStore.state === State.File, pathname(), isShare(), obj)
  const getLinkByObj = (
    obj: Obj,
    type?: URLType,
    encodeAll?: boolean,
    opts?: { preview?: boolean },
  ) => {
    const at = locate(obj)
    return getLinkByDirAndObj(at.dir, at.obj, type, isShare(), encodeAll, opts)
  }
  /** The full path of obj as the fs endpoints expect it (shares: /@s/<id>/...). */
  const objPath = (obj: Obj) => {
    const at = locate(obj)
    return pathJoin(at.dir, at.obj.name).replace(/\/$/, "")
  }
  const rawLink = (obj: Obj, encodeAll?: boolean) => {
    return getLinkByObj(obj, "direct", encodeAll)
  }
  return {
    getLinkByObj: getLinkByObj,
    objPath: objPath,
    rawLink: rawLink,
    proxyLink: (obj: Obj, encodeAll?: boolean) => {
      return getLinkByObj(obj, "proxy", encodeAll)
    },
    /** The file for a viewer or player (a share counts it as a preview, not a download). */
    previewLink: (obj: Obj, encodeAll?: boolean) => {
      return getLinkByObj(obj, "direct", encodeAll, { preview: true })
    },
    currentPreviewLink: (encodeAll?: boolean) => {
      return getLinkByObj(objStore.obj, "direct", encodeAll, { preview: true })
    },
    previewPage: (obj: Obj, encodeAll?: boolean) => {
      return getLinkByObj(obj, "preview", encodeAll)
    },
    currentObjLink: (encodeAll?: boolean) => {
      return rawLink(objStore.obj, encodeAll)
    },
  }
}

export const useSelectedLink = () => {
  const { previewPage, rawLink: rawUrl } = useLink()
  const rawLinks = (encodeAll?: boolean) => {
    return selectedObjs()
      .filter((obj) => !obj.is_dir)
      .map((obj) => rawUrl(obj, encodeAll))
  }
  return {
    rawLinks: rawLinks,
    previewPagesText: () => {
      return selectedObjs()
        .map((obj) => previewPage(obj, true))
        .join("\n")
    },
    rawLinksText: (encodeAll?: boolean) => {
      return rawLinks(encodeAll).join("\n")
    },
  }
}

export const useCopyLink = () => {
  const t = useT()
  const { copy } = useUtil()
  const { previewPagesText, rawLinksText } = useSelectedLink()
  const { currentObjLink, rawLink, objPath } = useLink()
  const { isShare } = useRouter()

  // Waits for every subtitle lookup, then copies. A failed lookup still copies
  // the command, without that file's subtitles, and says so.
  const copyMpv = async (objs: Obj[]) => {
    const { command, count, subtitleFailed } = await buildMpvCommandFor(objs, {
      linkOf: (obj) => rawLink(obj, true),
      pathOf: objPath,
      password: isShare() ? "" : password(),
    })
    if (count === 0) return
    if (subtitleFailed) notify.warning(t("home.toolbar.mpv_subtitle_failed"))
    copy(command)
  }
  return {
    copySelectedPreviewPage: () => {
      copy(previewPagesText())
    },
    copySelectedRawLink: (encodeAll?: boolean) => {
      copy(rawLinksText(encodeAll))
    },
    copyCurrentRawLink: (encodeAll?: boolean) => {
      copy(currentObjLink(encodeAll))
    },
    /** Whether the selection holds anything mpv can play (entries hide otherwise). */
    canCopyMpvCommand: () => selectedObjs().some(isMpvMedia),
    copySelectedMpvCommand: () => copyMpv(selectedObjs()),
    copyMpvCommand: (obj: Obj) => copyMpv([obj]),
  }
}
