const UNITS = ["B", "KiB", "MiB", "GiB", "TiB", "PiB"]

export const formatBytes = (n: number | undefined): string => {
  if (n === undefined || !Number.isFinite(n) || n < 0) return "-"
  let v = n
  let i = 0
  while (v >= 1024 && i < UNITS.length - 1) {
    v /= 1024
    i++
  }
  return `${i === 0 ? v : v.toFixed(v >= 100 ? 0 : v >= 10 ? 1 : 2)} ${UNITS[i]}`
}

/** `1h 02m`, `3m 05s`, `12s`. */
export const formatEta = (ms: number | undefined): string | undefined => {
  if (ms === undefined || !Number.isFinite(ms) || ms < 0) return undefined
  const s = Math.round(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`
  if (m > 0) return `${m}m ${String(sec).padStart(2, "0")}s`
  return `${sec}s`
}

/**
 * Split a long string so CSS can truncate the head and keep the tail visible:
 * `[head, tail]`, with `tail` the last `keep` characters.
 */
export const splitMiddle = (s: string, keep = 14): [string, string] =>
  s.length <= keep * 2 ? [s, ""] : [s.slice(0, s.length - keep), s.slice(-keep)]

export const formatTime = (iso: string | undefined): string => {
  if (!iso) return "-"
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleString()
}
