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
import frp from "./frp.json"
import login from "./login.json"
import manage from "./manage.json"
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
import shares from "./shares.json"
import storages from "./storages.json"
import tasks from "./tasks.json"
import users from "./users.json"

export const dict = {
  br,
  common,
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
  manage,
  media,
  metas,
  palette,
  plugins,
  settings_other,
  // settings_center adds settings.groups.* / settings.items.* / settings.home.*
  // and settings_form adds settings.form.* and the S3 / other page texts,
  // beside the per-setting labels without touching the Crowdin-managed file.
  settings: { ...settings, ...settings_center, ...settings_form },
  shell,
  states,
  shares,
  storages,
  tasks,
  transfers,
  users,
}
