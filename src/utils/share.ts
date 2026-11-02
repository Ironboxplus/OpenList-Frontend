import { ShareInfo } from "~/types"
import { base_path } from "."

const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"

export const randomPwd = () => {
  const arr: string[] = Array.from(
    { length: 5 },
    () => letters[Math.floor(Math.random() * letters.length)],
  )
  return arr.join("")
}

export const makeTemplateData = (
  share: ShareInfo,
  other?: { [k: string]: any },
) => {
  return {
    base_url: location.origin + base_path,
    ...share,
    ...other,
  }
}

const expireDateIncrementRegExp =
  /^\+(?=\d+[wdHms])(?:(\d+)w)?(?:(\d+)d)?(?:(\d+)H)?(?:(\d+)m)?(?:(\d+)s)?(?:(\d+)ms)?$/

const toInt = (s: string | undefined) => {
  if (s === undefined) return 0
  const n = Number.parseInt(s)
  return Number.isNaN(n) ? 0 : n
}

export const getExpireDate = (dateStr: string) => {
  const match = expireDateIncrementRegExp.exec(dateStr)
  if (match) {
    const w = toInt(match[1])
    const d = toInt(match[2]) + w * 7
    const H = toInt(match[3]) + d * 24
    const m = toInt(match[4]) + H * 60
    const s = toInt(match[5]) + m * 60
    const ms = toInt(match[6]) + s * 1000
    return new Date(Date.now() + ms)
  } else {
    return new Date(dateStr)
  }
}

/**
 * Whether a link is a share content link: /sd/ or /sad/ at the start of the
 * path, after the site's base path (a folder that happens to be called sd does
 * not count).
 */
export const isShareContentUrl = (url: string): boolean => {
  if (!url) return false
  // Drop scheme and host, then the base path, then look at the route.
  const at = url.indexOf("://")
  let path =
    at < 0
      ? url
      : url.slice(
          url.indexOf("/", at + 3) < 0 ? url.length : url.indexOf("/", at + 3),
        )
  if (base_path && path.startsWith(base_path + "/"))
    path = path.slice(base_path.length)
  const rest = path.startsWith("/sd/")
    ? path.slice(4)
    : path.startsWith("/sad/")
      ? path.slice(5)
      : ""
  return rest !== "" && !rest.startsWith("?") && !rest.startsWith("#")
}

/** The HTTP status a HEAD of the link answers (HEAD is never counted by a share); 0 if it cannot be asked. */
export const probeStatus = async (url: string): Promise<number> => {
  try {
    return (await fetch(url, { method: "HEAD" })).status
  } catch {
    return 0
  }
}

/**
 * Marks a link to a share's file as a preview (preview=1), which a share that
 * switched downloads off still serves. Links to anything else, and links already
 * marked, come back unchanged. Downloads must not go through this.
 */
export const asPreview = (url: string): string => {
  if (!isShareContentUrl(url) || /[?&]preview=1(&|#|$)/.test(url)) return url
  const hash = url.indexOf("#")
  const head = hash < 0 ? url : url.slice(0, hash)
  const tail = hash < 0 ? "" : url.slice(hash)
  return `${head}${head.includes("?") ? "&" : "?"}preview=1${tail}`
}
