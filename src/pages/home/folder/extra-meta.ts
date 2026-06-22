/**
 * Pure, defensive normalization of an object's optional `extra` metadata bag.
 * Kept framework-free so it can be unit-tested in isolation. The guiding rule:
 * NEVER throw — any missing/null/wrong-typed field degrades to a safe default,
 * so an unexpected or changed backend payload can't crash a file row.
 */

export interface NormalizedExtra {
  /** Human duration string (h:mm:ss / m:ss), "" when absent/invalid. */
  duration: string
  /** Resolution badge text, "" when absent/invalid. */
  resolution: string
  /** Whether the item is starred. */
  starred: boolean
  /** Provider tags (strings only). */
  tags: string[]
}

/** Format a duration in seconds as h:mm:ss or m:ss. Returns "" if not usable. */
export const fmtDuration = (v: unknown): string => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN
  // Sub-second (or non-positive) durations aren't worth a "0:00" badge.
  if (!Number.isFinite(n) || n < 1) return ""
  const total = Math.floor(n)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (x: number) => x.toString().padStart(2, "0")
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

/** Normalize an unknown `extra` value into a safe, fully-typed shape. */
export const readExtra = (extra: unknown): NormalizedExtra => {
  const e: Record<string, unknown> =
    extra && typeof extra === "object" ? (extra as Record<string, unknown>) : {}
  return {
    duration: fmtDuration(e.duration),
    resolution: typeof e.resolution === "string" ? e.resolution : "",
    starred: e.starred === true,
    tags: Array.isArray(e.tags)
      ? e.tags.filter((t): t is string => typeof t === "string")
      : [],
  }
}

/** Whether there is anything worth rendering. */
export const hasExtra = (n: NormalizedExtra): boolean =>
  !!n.duration || !!n.resolution || n.starred || n.tags.length > 0
