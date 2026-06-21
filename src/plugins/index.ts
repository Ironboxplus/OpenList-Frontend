import { registerPlugin } from "./registry"
import { diskUsagePlugin } from "./builtin/disk-usage"
import { favoritesPlugin } from "./builtin/favorites/FavoritesWidget"
import { statsPlugin } from "./builtin/stats"
import { mediaPreviewPlugin } from "./builtin/media-preview"
import { loadExternalPlugins, type ExternalManifest } from "./loader"
import { r } from "~/utils"
import { log } from "~/utils/log"

export * from "./registry"
export * from "./PluginSlot"
export * from "./loader"

let installed = false

/**
 * Register the built-in plugins. Called once during app bootstrap. Idempotent
 * so hot-module-reload in dev doesn't double-register.
 */
export const installBuiltinPlugins = () => {
  if (installed) return
  installed = true
  registerPlugin(diskUsagePlugin)
  registerPlugin(favoritesPlugin)
  registerPlugin(statsPlugin)
  registerPlugin(mediaPreviewPlugin)
}

/**
 * Fetch the backend plugin manifest and hot-load any frontend (JS) plugins it
 * advertises. Best-effort: failures (no backend, no plugins) are swallowed.
 */
export const installExternalPlugins = async () => {
  try {
    const resp: { code: number; data?: ExternalManifest } =
      await r.get("/plugin/manifest")
    if (resp.code === 200 && resp.data?.plugins?.length) {
      const loaded = await loadExternalPlugins(resp.data)
      if (loaded.length) log("loaded external plugins:", loaded.join(", "))
    }
  } catch {
    /* plugin support optional */
  }
}
