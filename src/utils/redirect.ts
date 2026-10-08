// Post-login redirect handling. The target comes from a query parameter, so it
// is untrusted: anything that could leave this origin is replaced by `/`.

/** In-site path check: leading single `/`, no scheme tricks, no control chars. */
export const isSafeRedirect = (raw: unknown): raw is string => {
  if (typeof raw !== "string" || raw === "") return false
  if (!raw.startsWith("/") || raw.startsWith("//")) return false
  // Browsers read `/\host` as `//host`; tabs and newlines are stripped by the
  // URL parser, so `/\t/host` would become `//host` too.
  if (/[\u0000-\u001f\u007f\\]/.test(raw)) return false
  try {
    return (
      new URL(raw, "http://redirect.invalid").origin ===
      "http://redirect.invalid"
    )
  } catch {
    return false
  }
}

/** The login page itself is never a useful destination (it would loop). */
export const resolveRedirect = (raw: unknown, fallback = "/"): string => {
  if (!isSafeRedirect(raw)) return fallback
  if (/^\/@login(?:[/?#]|$)/.test(raw)) return fallback
  return raw
}

export interface LocationLike {
  pathname: string
  search: string
  hash: string
}

/** `/@login?redirect=…` carrying the whole current location. */
export const loginUrlFor = (loc: LocationLike): string =>
  `/@login?redirect=${encodeURIComponent(loc.pathname + loc.search + loc.hash)}`
