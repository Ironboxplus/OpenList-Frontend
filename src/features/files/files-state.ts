// What went wrong when a directory failed to load, in terms the user can act
// on. The backend returns free-text messages, so this is a best-effort
// classification; anything unrecognised stays "unknown" and shows the raw text.

export type FilesErrorKind =
  | "network"
  | "forbidden"
  | "not_found"
  | "storage"
  | "unknown"

export const classifyFilesError = (msg: string): FilesErrorKind => {
  const m = msg.toLowerCase()
  if (m.includes("storage not found") || m.includes("please add a storage"))
    return "storage"
  if (
    m.includes("network") ||
    m.includes("timeout") ||
    m.includes("failed to fetch") ||
    m.includes("econn")
  )
    return "network"
  if (
    m.includes("permission") ||
    m.includes("forbidden") ||
    m.includes("403") ||
    m.includes("unauthorized") ||
    m.includes("401")
  )
    return "forbidden"
  if (
    m.includes("not found") ||
    m.includes("404") ||
    m.includes("object not found")
  )
    return "not_found"
  return "unknown"
}

/** Retrying only helps for failures that can be transient. */
export const canRetry = (kind: FilesErrorKind): boolean =>
  kind === "network" || kind === "unknown" || kind === "not_found"
