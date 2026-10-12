// Backend-shaped data the page tests feed to the fake transport.
import { Type } from "~/types"

export const COMMON_ITEMS = [
  {
    name: "mount_path",
    type: Type.String,
    default: "",
    required: true,
    help: "mount_path-tips",
  },
  { name: "order", type: Type.Number, default: "0", help: "x" },
  { name: "remark", type: Type.Text, default: "" },
  { name: "cache_expiration", type: Type.Number, default: "30", help: "x" },
  { name: "web_proxy", type: Type.Bool, default: "false" },
  {
    name: "webdav_policy",
    type: Type.Select,
    options: "native_proxy,use_proxy_url,302_redirect",
    default: "native_proxy",
  },
  { name: "down_proxy_url", type: Type.Text, default: "" },
  { name: "enable_sign", type: Type.Bool, default: "false" },
]

export const DRIVERS = {
  Local: {
    common: COMMON_ITEMS,
    additional: [
      {
        name: "root_folder_path",
        type: Type.String,
        default: "",
        required: true,
      },
      { name: "thumbnail", type: Type.Bool, default: "false" },
      { name: "show_hidden", type: Type.Bool, default: "true" },
      { name: "mkdir_perm", type: Type.String, default: "777" },
      { name: "chunk", type: Type.Number, default: "8" },
      { name: "ratio", type: Type.Float, default: "1.5" },
      {
        name: "recycle_bin_path",
        type: Type.String,
        default: "delete permanently",
      },
    ],
    config: {
      name: "Local",
      local_sort: true,
      need_ms: false,
      default_root: "/",
      alert: "",
    },
  },
  Aliyundrive: {
    common: COMMON_ITEMS,
    additional: [
      { name: "refresh_token", type: Type.String, default: "", required: true },
      {
        name: "order_by",
        type: Type.Select,
        options: "name,size,updated_at",
        default: "name",
      },
    ],
    config: {
      name: "Aliyundrive",
      local_sort: false,
      need_ms: true,
      default_root: "root",
      alert: "warning|This driver is unstable",
    },
  },
}

export const STORAGE = {
  id: 7,
  mount_path: "/local",
  order: 2,
  driver: "Local",
  status: "work",
  addition: JSON.stringify({
    root_folder_path: "/data",
    thumbnail: true,
    show_hidden: false,
    mkdir_perm: "755",
    chunk: 4,
    ratio: 2.5,
    recycle_bin_path: "delete permanently",
  }),
  remark: "note",
  modified: "2026-01-01T00:00:00Z",
  cache_expiration: 30,
  web_proxy: false,
  webdav_policy: "native_proxy",
  down_proxy_url: "",
  enable_sign: false,
  disabled: false,
}

export const ADMIN_ME = {
  id: 1,
  username: "admin",
  password: "",
  base_path: "/",
  role: 2,
  permission: 0x7fff,
  sso_id: "",
  disabled: false,
  allow_ldap: false,
  otp: false,
}

export const USER = {
  id: 5,
  username: "alice",
  password: "",
  base_path: "/alice",
  role: 0,
  permission: 0b101,
  sso_id: "",
  disabled: false,
  allow_ldap: false,
}

export const KEYS = [
  {
    id: "k1",
    title: "laptop",
    fingerprint: "SHA256:abc",
    added_time: "2026-01-01T00:00:00Z",
    last_used_time: "2026-02-01T00:00:00Z",
  },
]

export const SHARE = {
  id: "abc",
  expires: null,
  pwd: "pw",
  max_accessed: 3,
  disabled: false,
  order_by: "name",
  order_direction: "asc",
  extract_folder: "front",
  files: ["/docs/a.txt", "/docs/b.txt"],
  remark: "note",
  readme: "",
  header: "",
  accessed: 1,
  new_id: "",
  creator: "admin",
  creator_role: 2,
}

export const META = {
  id: 3,
  path: "/secret",
  password: "pw",
  read_users: [5],
  read_users_sub: true,
  write_users: [],
  write_users_sub: false,
  p_sub: true,
  write: false,
  w_sub: false,
  hide: "a\nb",
  h_sub: false,
  readme: "",
  r_sub: false,
  header: "",
  header_sub: false,
}
