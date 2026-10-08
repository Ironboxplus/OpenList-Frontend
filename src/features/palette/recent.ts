// The last few palette entries the user ran, shown when the query is empty.

export const RECENT_KEY = "openlist.palette.recent"
export const MAX_RECENT = 5

type Store = Pick<Storage, "getItem" | "setItem">

export const readRecent = (storage: Store): string[] => {
  try {
    const raw = storage.getItem(RECENT_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((v): v is string => typeof v === "string")
      .slice(0, MAX_RECENT)
  } catch {
    return []
  }
}

/** Puts `id` first (once) and keeps at most MAX_RECENT; returns the new list. */
export const pushRecent = (storage: Store, id: string): string[] => {
  const next = [id, ...readRecent(storage).filter((x) => x !== id)].slice(
    0,
    MAX_RECENT,
  )
  try {
    storage.setItem(RECENT_KEY, JSON.stringify(next))
  } catch {
    // Storage full or blocked: the list just does not persist.
  }
  return next
}
