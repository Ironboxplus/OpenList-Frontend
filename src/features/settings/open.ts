import type { SettingContribution } from "./registry"

/** External entries open in a new tab; everything else goes through the router. */
export const openSetting = (
  entry: SettingContribution,
  to: (path: string) => void,
) => {
  if (entry.external) {
    window.open(entry.route, "_blank", "noopener,noreferrer")
  } else {
    to(entry.route)
  }
}
