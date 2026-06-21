import { createSignal, type Component } from "solid-js"
import { readPersisted, writePersisted } from "~/utils/persisted"

/**
 * A named location in the UI that plugins can contribute components to.
 * Intentionally a plain string (not a closed union) so new slots can be added
 * without touching the registry — the host exposes slots, plugins fill them.
 */
export type SlotName = string

export interface SlotContribution {
  slot: SlotName
  component: Component
  /** Lower renders first within a slot. Defaults to 0. */
  order?: number
}

export interface Plugin {
  id: string
  name?: string
  version?: string
  /** Defaults to enabled; set false to keep registered but inert. */
  enabled?: boolean
  contributions: SlotContribution[]
}

export interface ResolvedContribution {
  pluginId: string
  component: Component
  order: number
}

/**
 * Pure: given a list of plugins, return the ordered components contributed to a
 * slot. Disabled plugins are skipped. Kept side-effect free for unit testing;
 * the reactive registry below is a thin wrapper over this.
 */
export const selectSlot = (
  plugins: Plugin[],
  slot: SlotName,
): ResolvedContribution[] => {
  return plugins
    .filter((p) => p.enabled !== false)
    .flatMap((p) =>
      p.contributions
        .filter((c) => c.slot === slot)
        .map((c) => ({
          pluginId: p.id,
          component: c.component,
          order: c.order ?? 0,
        })),
    )
    .sort((a, b) => a.order - b.order)
}

export type EnabledOverrides = Record<string, boolean>

/**
 * Pure: apply a persisted enabled/disabled override to a plugin. Returns the
 * same object when no override applies so callers can cheaply detect no-ops.
 */
export const applyEnabledOverride = (
  plugin: Plugin,
  overrides: EnabledOverrides,
): Plugin => {
  if (!(plugin.id in overrides)) return plugin
  return { ...plugin, enabled: overrides[plugin.id] }
}

const ENABLED_KEY = "plugin-enabled-overrides"
const loadOverrides = (): EnabledOverrides =>
  readPersisted<EnabledOverrides>(
    typeof localStorage !== "undefined" ? localStorage : undefined,
    ENABLED_KEY,
    {},
  )
const saveOverride = (id: string, enabled: boolean) => {
  const overrides = loadOverrides()
  overrides[id] = enabled
  writePersisted(
    typeof localStorage !== "undefined" ? localStorage : undefined,
    ENABLED_KEY,
    overrides,
  )
}

const [plugins, setPlugins] = createSignal<Plugin[]>([])

export { plugins }

/** Register (or hot-replace, by id) a plugin, honouring persisted enable state. */
export const registerPlugin = (plugin: Plugin) => {
  const resolved = applyEnabledOverride(plugin, loadOverrides())
  setPlugins((prev) => [...prev.filter((p) => p.id !== resolved.id), resolved])
}

/** Remove a plugin by id — the basis for hot-unload/reload. */
export const unregisterPlugin = (id: string) => {
  setPlugins((prev) => prev.filter((p) => p.id !== id))
}

/** Toggle a plugin on/off and persist the choice across reloads. */
export const setPluginEnabled = (id: string, enabled: boolean) => {
  saveOverride(id, enabled)
  setPlugins((prev) => prev.map((p) => (p.id === id ? { ...p, enabled } : p)))
}

/** Reactive: components for a slot, recomputed as plugins change. */
export const slotComponents = (slot: SlotName): ResolvedContribution[] =>
  selectSlot(plugins(), slot)
