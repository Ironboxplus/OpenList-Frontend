export const splitLines = (s: string) =>
  s
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean)

export const rid = () => {
  try {
    return crypto.randomUUID().slice(0, 8)
  } catch {
    return Math.random().toString(36).slice(2, 10)
  }
}

/** Seconds-since-epoch as a short age: 5s, 3m, 2h, 4d. */
export const ago = (t: number) => {
  if (!t) return "—"
  const d = Math.max(0, Math.floor(Date.now() / 1000) - t)
  if (d < 60) return `${d}s`
  if (d < 3600) return `${Math.floor(d / 60)}m`
  if (d < 86400) return `${Math.floor(d / 3600)}h`
  return `${Math.floor(d / 86400)}d`
}

/** A duration in seconds as a short span: 45s, 3m, 2h10m. Negative/zero => 0s. */
export const span = (sec: number) => {
  const s = Math.max(0, Math.floor(sec || 0))
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m`
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return m ? `${h}h${m}m` : `${h}h`
}
