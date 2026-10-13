// What the plugins page lists, mapped from the frontend plugin registry.
import type { Plugin } from "~/plugins/registry"

export interface PluginRow {
  id: string
  name: string
  version?: string
  /** The slots the plugin contributes to, each once, in registration order. */
  slots: string[]
  enabled: boolean
}

export const pluginRows = (plugins: readonly Plugin[]): PluginRow[] =>
  plugins.map((p) => ({
    id: p.id,
    name: p.name || p.id,
    version: p.version,
    slots: [...new Set(p.contributions.map((c) => c.slot))],
    enabled: p.enabled !== false,
  }))
