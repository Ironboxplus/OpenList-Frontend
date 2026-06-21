import { registerPlugin, type Plugin } from "./registry"

export interface ExternalManifestEntry {
  id: string
  url: string
}

export interface ExternalManifest {
  plugins: ExternalManifestEntry[]
}

interface PluginModule {
  default?: Plugin
  plugin?: Plugin
}

export interface LoadOptions {
  /** Injectable for tests; defaults to a dynamic ESM import. */
  importer?: (url: string) => Promise<PluginModule>
  /** Injectable for tests; defaults to the global registry. */
  register?: (plugin: Plugin) => void
}

const defaultImporter = (url: string): Promise<PluginModule> =>
  import(/* @vite-ignore */ url)

/**
 * Dynamically import each plugin in the manifest and register it. A single
 * failing/empty module is skipped without aborting the others. Returns the ids
 * that were successfully registered. This is the frontend hot-load path: feed it
 * a manifest the backend serves, and re-run it to pick up changes.
 */
export const loadExternalPlugins = async (
  manifest: ExternalManifest,
  options: LoadOptions = {},
): Promise<string[]> => {
  const importer = options.importer ?? defaultImporter
  const register = options.register ?? registerPlugin
  const loaded: string[] = []
  for (const entry of manifest.plugins) {
    try {
      const mod = await importer(entry.url)
      const plugin = mod.default ?? mod.plugin
      if (!plugin) continue
      register(plugin)
      loaded.push(plugin.id)
    } catch {
      /* one bad plugin must not break the rest */
    }
  }
  return loaded
}
