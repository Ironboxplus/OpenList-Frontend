import br from "./br.json"
import common from "./common.json"
import dashboard from "./dashboard.json"
import drivers from "./drivers.json"
import errors from "./errors.json"
import files from "./files.json"
import global from "./global.json"
import home from "./home.json"
import index from "./index.json"
import indexes from "./indexes.json"
import init from "./init.json"
import fork from "./fork.json"
import frp from "./frp.json"
import login from "./login.json"
import manage from "./manage.json"
import manage_media from "./manage_media.json"
import media from "./media.json"
import metas from "./metas.json"
import palette from "./palette.json"
import plugins from "./plugins.json"
import shell from "./shell.json"
import states from "./states.json"
import transfers from "./transfers.json"
import settings_other from "./settings_other.json"
import settings from "./settings.json"
import settings_center from "./settings_center.json"
import settings_form from "./settings_form.json"
import settings_seed from "./settings_seed.json"
import shares from "./shares.json"
import storages from "./storages.json"
import tasks from "./tasks.json"
import users from "./users.json"

type Dict = { [key: string]: string | Dict }

// merge layers `over` on top of `base`, key by key.
const merge = <T extends Dict>(base: T, over: Dict): T => {
  const out: Dict = { ...base }
  for (const [k, v] of Object.entries(over)) {
    const cur = out[k]
    out[k] =
      typeof v === "object" && typeof cur === "object" ? merge(cur, v) : v
  }
  return out as T
}

// fork.json holds zh-CN texts (en is empty) for keys we added inside
// Crowdin-managed files, so a Crowdin sync cannot wipe them.
const forkNs = <K extends string>(ns: K, base: Dict): Dict =>
  merge(base, ((fork as Dict)[ns] as Dict) ?? {})

export const dict = {
  br,
  common,
  frp,
  dashboard,
  drivers,
  errors,
  files,
  global,
  home,
  index,
  indexes,
  init,
  login,
  // manage_media adds the media pages' texts (ours) beside the Crowdin-managed file.
  manage: forkNs("manage", {
    ...manage,
    sidemenu: { ...manage.sidemenu, ...manage_media.sidemenu },
    media_lib: { ...manage.media_lib, ...manage_media.media_lib },
  }),
  media,
  metas,
  palette,
  plugins,
  settings_other,
  settings_seed,
  // settings_center adds settings.groups.* / settings.items.* / settings.home.*
  // and settings_form adds settings.form.* and the S3 / other page texts,
  // beside the per-setting labels without touching the Crowdin-managed file.
  settings: forkNs("settings", {
    ...settings,
    ...settings_center,
    ...settings_form,
  }),
  shell,
  states,
  shares: forkNs("shares", shares),
  storages: forkNs("storages", storages),
  tasks,
  transfers,
  users: forkNs("users", users),
}
