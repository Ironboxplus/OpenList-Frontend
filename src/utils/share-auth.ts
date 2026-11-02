// Access tokens of password-protected shares. A visitor trades the password for
// a token once (POST /public/sharing_auth); the token then rides on API calls as
// X-Share-Token and on direct links as ?auth=, so the password itself is never
// kept or put in a URL.
const KEY = "share-token:"
// The backend token lives 24 hours (less if the share expires sooner); drop ours
// a little earlier and let a 401/403 clean up the rest.
const LIFETIME = 23 * 3600 * 1000

interface Stored {
  token: string
  exp: number
}

/** The share id of a `/@s/<id>/...` path, or "" for any other path. */
export const shareIdOf = (path: string): string => {
  if (!path.startsWith("/@s/")) return ""
  const rest = path.slice(4)
  const end = rest.indexOf("/")
  return end < 0 ? rest : rest.slice(0, end)
}

export const getShareToken = (id: string): string => {
  if (!id) return ""
  try {
    const raw = localStorage.getItem(KEY + id)
    if (!raw) return ""
    const s = JSON.parse(raw) as Stored
    if (s.exp > Date.now()) return s.token
    localStorage.removeItem(KEY + id)
  } catch {
    // Storage blocked or damaged: act as if there were no token.
  }
  return ""
}

export const setShareToken = (id: string, token: string) => {
  try {
    const s: Stored = { token, exp: Date.now() + LIFETIME }
    localStorage.setItem(KEY + id, JSON.stringify(s))
  } catch {
    // Without storage the visitor is asked again on the next page load.
  }
}

export const clearShareToken = (id: string) => {
  try {
    localStorage.removeItem(KEY + id)
  } catch {
    // nothing stored, nothing to clear
  }
}

/** Appends ?auth= / &auth= for the share's token, if there is one. */
export const withShareToken = (url: string, id: string): string => {
  const token = getShareToken(id)
  if (!token) return url
  return `${url}${url.includes("?") ? "&" : "?"}auth=${encodeURIComponent(token)}`
}

/** The `path` an API request body carries, if it has one. */
export const bodyPath = (data: unknown): string => {
  try {
    const obj = typeof data === "string" ? JSON.parse(data) : data
    const p = (obj as { path?: unknown } | null)?.path
    return typeof p === "string" ? p : ""
  } catch {
    return ""
  }
}
