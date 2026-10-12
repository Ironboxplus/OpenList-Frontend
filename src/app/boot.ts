// What a page load does once /public/settings has arrived. Kept out of App.tsx
// so the backend-dependent steps are testable on their own.
import { setSettings } from "~/store/settings"
import { isTsWorker } from "~/utils/backend"
import { applyCustomize } from "~/utils/customize"
import { initPluginEngine } from "~/utils/plugin_engine"

export const onSettingsLoaded = (settings: Record<string, string>) => {
  setSettings(settings)
  // Inject customize_head/body and the site icon. Whether anything is
  // injected is applyCustomize's own call (it skips HTML the Go backend
  // already filled in), so no backend check here.
  applyCustomize()
  // The upstream plugin engine talks to /public/plugins, which only the TS
  // backend serves; the Go backend has its own plugin runtime. The backend
  // kind is known only once setSettings has recorded it.
  if (isTsWorker()) initPluginEngine()
}
