import { createLocalStorage } from "@solid-primitives/storage"
import { isMobile } from "~/utils/compatibility"

const [local, setLocal, { remove, clear, toJSON }] = createLocalStorage()
// export function isValidKey(
//   key: string | number | symbol,
//   object: object
// ): key is keyof typeof object {
//   return key in object
// }

export const initialLocalSettings = [
  {
    key: "aria2_rpc_url",
    default: "http://localhost:6800/jsonrpc",
  },
  {
    key: "aria2_rpc_secret",
    default: "",
  },
  {
    key: "global_default_layout",
    default: "grid",
    type: "select",
    options: ["list", "grid", "image"],
  },
  {
    key: "show_folder_in_image_view",
    default: "top",
    type: "select",
    options: ["top", "bottom", "none"],
  },
  {
    key: "show_sidebar",
    default: "none",
    type: "select",
    options: ["none", "visible"],
  },
  {
    key: "show_count_msg",
    default: "none",
    type: "select",
    options: ["none", "visible"],
  },
  {
    key: "position_of_header_navbar",
    default: "static",
    type: "select",
    options: ["static", "sticky", "only_navbar_sticky"],
  },
  {
    key: "grid_item_size",
    default: "90",
    type: "number",
  },
  {
    key: "list_item_filename_overflow",
    default: "ellipsis",
    type: "select",
    options: ["ellipsis", "scrollable", "multi_line"],
  },
  {
    key: "open_item_on_checkbox",
    default: "direct",
    type: "select",
    options: ["direct", "dblclick", "disable_while_checked"],
    hidden: false,
  },
  {
    key: "editor_font_size",
    default: "14",
    type: "number",
  },
  {
    key: "editor_word_wrap",
    default: "false",
    type: "select",
    options: ["false", "true"],
  },
  {
    key: "editor_minimap",
    default: "true",
    type: "select",
    options: ["false", "true"],
  },
  {
    key: "show_gallery_thumbnails",
    default: "visible",
    type: "select",
    options: ["none", "visible"],
  },
]
export type LocalSetting = (typeof initialLocalSettings)[number]
for (const setting of initialLocalSettings) {
  if (!local[setting.key]) {
    setLocal(setting.key, setting.default)
  }
}

// The default view became "grid". A browser that stored the old default ("list",
// written on its first visit) is moved over once; a choice made after that, in
// the local settings or per folder in the view menu, is kept.
if (!local["layout_default_v2"]) {
  if (local["global_default_layout"] === "list") {
    setLocal("global_default_layout", "grid")
  }
  setLocal("layout_default_v2", "1")
}

export { local, setLocal, remove, clear, toJSON }
