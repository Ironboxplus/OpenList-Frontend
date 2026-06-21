import type { Plugin } from "../../registry"

/**
 * Media Hover Preview — behavior-only plugin with no slot contributions.
 * When enabled, list-view rows show an enlarged thumbnail on hover
 * (desktop / non-touch only). Toggle via the Plugins management page.
 */
export const mediaPreviewPlugin: Plugin = {
  id: "builtin.media-preview",
  name: "Media Hover Preview",
  contributions: [],
}
