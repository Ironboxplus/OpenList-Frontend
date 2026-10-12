import Handlebars from "handlebars"

export const firstUpperCase = (str: string) => {
  if (!str || str.length === 0) {
    return ""
  }
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export const trimLeft = (str: string, sub: string) => {
  return str.startsWith(sub) ? str.slice(sub.length) : str
}

export function getFileSize(size: number) {
  if (!size) return "-"

  const num = 1024.0 //byte

  if (size < num) return size + "B"
  if (size < Math.pow(num, 2)) return (size / num).toFixed(2) + "K" //kb
  if (size < Math.pow(num, 3)) return (size / Math.pow(num, 2)).toFixed(2) + "M" //M
  if (size < Math.pow(num, 4)) return (size / Math.pow(num, 3)).toFixed(2) + "G" //G
  return (size / Math.pow(num, 4)).toFixed(2) + "T" //T
}

const full = (p: number) => {
  return p < 10 ? "0" + p : p
}

export function formatDate(dateStr: string) {
  const date = new Date(dateStr)
  const year = date.getFullYear()
  const mon = date.getMonth() + 1
  const day = date.getDate()
  const hour = date.getHours()
  const min = date.getMinutes()
  const sec = date.getSeconds()

  return (
    year +
    "-" +
    full(mon) +
    "-" +
    full(day) +
    " " +
    full(hour) +
    ":" +
    full(min) +
    ":" +
    full(sec)
  )
}

/**
 * Compact variant of {@link formatDate} for dense list rows.
 *
 * `formatDate` always renders 19 characters (`2026-01-03 04:58:30`), which in the
 * file list forces the `modified` column to reserve a third of the row width for
 * information the user rarely reads at that precision. This drops the seconds
 * (never meaningful for a directory listing) and drops the year for dates in the
 * current year, giving at most 11 characters:
 *
 *   this year → `01-03 04:58`
 *   past year → `2025-12-29`
 *
 * Callers should keep the full timestamp reachable (e.g. a `title` attribute) so
 * precision is hidden, not lost.
 *
 * Returns `"-"` for a missing or unparseable date. Several drivers omit
 * `modified` entirely, and `new Date("")` yields an Invalid Date whose getters
 * are all `NaN` — `formatDate` renders that as `NaN-NaN-NaN NaN:NaN:NaN`.
 */
export function formatDateCompact(dateStr?: string, now = new Date()) {
  if (!dateStr) return "-"
  const date = new Date(dateStr)
  const time = date.getTime()
  if (Number.isNaN(time)) return "-"
  // Some drivers use a zero/epoch sentinel for "unknown"; showing 1970 is noise.
  if (time <= 0) return "-"

  const mon = full(date.getMonth() + 1)
  const day = full(date.getDate())
  if (date.getFullYear() !== now.getFullYear()) {
    return date.getFullYear() + "-" + mon + "-" + day
  }
  return (
    mon +
    "-" +
    day +
    " " +
    full(date.getHours()) +
    ":" +
    full(date.getMinutes())
  )
}

export type ConvertURLArgs = {
  raw_url: string
  name: string
  d_url: string
  // Optional external subtitle URL, used by players that accept one (e.g. mpv
  // via mpv-handler's subfile parameter).
  sub_url?: string
  ts?: boolean
}

// applyEncodeOps applies the encoding flags from a placeholder's op prefix
// (the chars between `$` and the keyword). Supported ops: e = encodeURIComponent,
// b = standard base64, B = URL-safe base64 with padding stripped (the exact
// encoding akiirui's mpv-handler expects). Ops are applied right-to-left,
// matching the historical $eb ordering. Only the captured prefix is inspected,
// so op letters inside a keyword (the "b" in "sub") are never mistaken for ops.
const applyEncodeOps = (value: string, opPrefix: string) => {
  let u = value
  for (const o of opPrefix.split("").reverse()) {
    if (o === "e") {
      u = encodeURIComponent(u)
    } else if (o === "b") {
      u = window.btoa(u)
    } else if (o === "B") {
      u = urlSafeBtoaNoPad(u)
    }
  }
  return u
}

export const convertURL = (scheme: string, args: ConvertURLArgs) => {
  let ans = scheme
  ans = ans.replace("$name", args.name)
  if (args.ts) {
    const d = new URL(args.d_url)
    const ts = Date.now()
    d.searchParams.set("openlist_ts", ts.toString())
    args.d_url = d.toString()
  }
  // Order matters: match $durl/$sub before $url so the longer tokens win.
  ans = ans.replace(/\$([ebB_]*)durl/, (_, ops) =>
    applyEncodeOps(args.d_url, ops),
  )
  ans = ans.replace(/\$([ebB_]*)sub/, (_, ops) =>
    applyEncodeOps(args.sub_url ?? "", ops),
  )
  ans = ans.replace(/\$([ebB_]*)url/, (_, ops) =>
    applyEncodeOps(args.raw_url, ops),
  )
  // Drop an empty trailing subfile parameter when no subtitle was supplied, so
  // a sub-aware scheme degrades cleanly to a plain launch.
  if (!args.sub_url) {
    ans = ans.replace(/[?&]subfile=$/, "")
  }
  return ans
}

export const strToRegExp = (str: string) => {
  str = str.trim()
  let pattern = str.replace(/^\/(.*)\/([a-z]*)$/, "$1")
  let args = str.replace(/^\/(.*)\/([a-z]*)$/, "$2")
  const reg = new RegExp(pattern, args)
  return reg
}

const ENC = {
  "+": "-",
  "/": "_",
  "=": ".",
}
const DEC = {
  "-": "+",
  _: "/",
  ".": "=",
}

export const safeBase64 = (base64: string) => {
  return base64.replace(/[+/=]/g, (m) => ENC[m as "+" | "/" | "="])
}

export const safeBtoa = (str: string) => {
  return safeBase64(window.btoa(str))
}

// URL-safe base64 with padding REMOVED — the exact form akiirui's mpv-handler
// requires (`+`→`-`, `/`→`_`, drop trailing `=`). This deliberately differs from
// safeBtoa above, which maps `=`→`.` for the backend `/i/` (ipa manifest) route:
// mpv-handler rejects `.` ("Failed to decode: Invalid symbol 46"), so the mpv
// `$B` op must strip padding instead of substituting it.
export const urlSafeBtoaNoPad = (str: string) => {
  return window
    .btoa(str)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
}

export const decodeText = (data: BufferSource, encoding?: string) => {
  const textDecoder = new TextDecoder(encoding)
  const text = textDecoder.decode(data)
  return text
}

// export function encodeText(text: string) {
//   const textEncoder = new TextEncoder()
//   const data = textEncoder.encode(text)
//   return data
// }

Handlebars.registerHelper("dateLocaleString", (date: Date) => {
  return new Date(date).toLocaleString()
})

Handlebars.registerHelper("add", (a: any, b: any) => {
  return a + b
})

Handlebars.registerHelper("eq", (a: any, b: any) => {
  return a === b
})

Handlebars.registerHelper("less", (a: any, b: any) => {
  return a < b
})

Handlebars.registerHelper("and", (a: boolean, b: boolean) => {
  return a && b
})

Handlebars.registerHelper("or", (a: boolean, b: boolean) => {
  return a || b
})

Handlebars.registerHelper("not", (v: boolean) => {
  return !v
})

Handlebars.registerHelper("filename", (path: string) => {
  return path.indexOf("/") === -1 ? path : path.slice(path.lastIndexOf("/") + 1)
})

export const matchTemplate = (
  templateStr: string,
  data: { [key: string]: any },
) => {
  const template = Handlebars.compile(templateStr)
  return template(data)
}

export const validateFilename = (
  name: string,
): { valid: boolean; error?: string } => {
  if (!name || name.trim().length === 0) {
    return { valid: false, error: "empty_input" }
  }
  const INVALID_CHARS = /[\/\\?<>*:|"]/
  if (INVALID_CHARS.test(name)) {
    return { valid: false, error: "invalid_filename_chars" }
  }

  return { valid: true }
}

/** Markup in a message from the backend, as the plain text a reader sees. */
export const plainText = (html: string): string =>
  new DOMParser().parseFromString(html, "text/html").documentElement
    .textContent ?? html
