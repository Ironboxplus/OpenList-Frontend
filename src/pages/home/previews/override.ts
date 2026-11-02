// Per-extension preview management: the preview_settings setting.
//
// Same format as AList's web UI (AlistGo/alist-web, src/store/settings.ts and
// src/pages/home/previews/index.ts), so a value written by one works in the other:
//   { "<extension, lower case>": { "order": ["<id>", ...], "disabled": ["<id>", ...] } }
// where an id is `builtin:<preview key>`, `iframe:<name of the iframe preview>`
// or `download`. Ids in `order` come first, in that order; the rest keep their
// usual order after them. Disabled previews are dropped. The download page is
// never dropped, so a file can always be fetched.

export interface PreviewOverride {
  order?: string[]
  disabled?: string[]
}
export type PreviewSettingsMap = Record<string, PreviewOverride>

const strings = (v: unknown): string[] | undefined =>
  Array.isArray(v)
    ? v.filter((x): x is string => typeof x === "string")
    : undefined

/** Reads the setting's value; anything unusable counts as "no overrides". */
export const parsePreviewSettings = (raw: string): PreviewSettingsMap => {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return {}
    const out: PreviewSettingsMap = {}
    for (const [ext, o] of Object.entries(parsed as Record<string, unknown>)) {
      if (!o || typeof o !== "object") continue
      const order = strings((o as PreviewOverride).order)
      const disabled = strings((o as PreviewOverride).disabled)
      out[ext.toLowerCase()] = { order, disabled }
    }
    return out
  } catch {
    return {}
  }
}

/** The id a preview of this app's list has in preview_settings. */
export const previewId = (key: string): string => {
  if (key === "download") return key
  if (key.startsWith("iframe-")) return `iframe:${key.slice("iframe-".length)}`
  return `builtin:${key}`
}

export const applyPreviewOverride = <T extends { key: string }>(
  list: T[],
  override: PreviewOverride | undefined,
): T[] => {
  if (!override) return list
  const disabled = new Set(override.disabled ?? [])
  const index = new Map<string, number>()
  ;(override.order ?? []).forEach((id, i) => index.set(id, i))
  const kept = list.filter((p) => {
    const id = previewId(p.key)
    return id === "download" || !disabled.has(id)
  })
  const at = (p: T) => index.get(previewId(p.key)) ?? Number.MAX_SAFE_INTEGER
  // Array.prototype.sort is stable: equal ranks keep their usual order.
  return [...kept].sort((a, b) => at(a) - at(b))
}
