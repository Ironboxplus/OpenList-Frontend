import { plugins } from "../../registry"

const PLUGIN_ID = "builtin.media-preview"

/**
 * Pure predicate deciding whether the hover thumbnail preview should be
 * shown for a given item. Kept side-effect free so it can be unit tested
 * without a DOM or reactive runtime.
 */
export interface PreviewCondition {
  thumb: string
  isTouch: boolean
  enabled: boolean
}

export const shouldShowPreview = ({
  thumb,
  isTouch,
  enabled,
}: PreviewCondition): boolean => {
  return enabled && !isTouch && thumb.length > 0
}

/**
 * Reactive helper: reads enabled state from the plugin registry signal so
 * ListItem can call this inside a SolidJS reactive context (createMemo,
 * Show, etc.) and get automatic re-evaluation when the user toggles the
 * plugin on/off.
 */
export const isMediaPreviewEnabled = (): boolean => {
  const plugin = plugins().find((p) => p.id === PLUGIN_ID)
  // Default to enabled when the plugin is registered but not explicitly disabled.
  return plugin !== undefined && plugin.enabled !== false
}
