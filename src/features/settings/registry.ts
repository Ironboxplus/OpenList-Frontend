// The one list of places an admin (or user) can configure something. The
// Manage sidebar, the settings home and the command palette all read it.
// Navigation only: each entry points at an existing page route.
import {
  BsArrowLeftRight,
  BsBucket,
  BsCameraFill,
  BsFront,
  BsHddNetwork,
  BsJoystick,
  BsMedium,
  BsPaletteFill,
  BsPersonCircle,
  BsPlugin,
  BsSearch,
  BsSpeedometer2,
  BsWindow,
} from "solid-icons/bs"
import { CgDatabase, CgShare } from "solid-icons/cg"
import { FaSolidBook, FaSolidDatabase } from "solid-icons/fa"
import { FiLogIn } from "solid-icons/fi"
import { SiMetabase } from "solid-icons/si"
import { TbArrowsUpDown, TbTopologyStar3 } from "solid-icons/tb"
import type { IconTypes } from "solid-icons"
import { UserMethods, UserRole, type User } from "~/types"

export type SettingGroupId =
  | "site"
  | "storage"
  | "indexing"
  | "access"
  | "extensions"
  | "system"

/**
 * Who may see an entry, mirroring the old sidebar's `role`/`show` rules:
 * admin (the default), general = admin or normal user, guest = everyone,
 * user_admin = admin or a user delegated "manage user info".
 */
export type SettingPermission = "admin" | "general" | "guest" | "user_admin"

export interface SettingContribution {
  id: string
  group: SettingGroupId
  /** i18n keys, `settings.items.<id>.title` / `.description`. */
  title: string
  description: string
  /** Bilingual, including the names of the settings inside the page. */
  keywords: string[]
  /** Site route (may carry a #hash) or, with `external`, a full URL. */
  route: string
  permission?: SettingPermission
  icon: IconTypes
  external?: true
}

export const SETTING_GROUPS: { id: SettingGroupId; title: string }[] = [
  { id: "site", title: "settings.groups.site" },
  { id: "storage", title: "settings.groups.storage" },
  { id: "indexing", title: "settings.groups.indexing" },
  { id: "access", title: "settings.groups.access" },
  { id: "extensions", title: "settings.groups.extensions" },
  { id: "system", title: "settings.groups.system" },
]

const item = (
  id: string,
  group: SettingGroupId,
  route: string,
  icon: IconTypes,
  keywords: string[],
  extra: Partial<Pick<SettingContribution, "permission" | "external">> = {},
): SettingContribution => ({
  id,
  group,
  title: `settings.items.${id}.title`,
  description: `settings.items.${id}.description`,
  keywords,
  route,
  icon,
  ...extra,
})

export const SETTINGS: SettingContribution[] = [
  // Site and appearance
  item("site", "site", "/@manage/settings/site", BsWindow, [
    "站点",
    "站点名称",
    "标题",
    "公告",
    "网站图标",
    "logo",
    "favicon",
    "site title",
    "announcement",
    "robots",
    "allow indexed",
    "customize head",
    "customize body",
  ]),
  item("style", "site", "/@manage/settings/style", BsPaletteFill, [
    "样式",
    "主题",
    "主题色",
    "外观",
    "自定义样式",
    "style",
    "theme",
    "main color",
    "appearance",
    "custom css",
  ]),
  item("preview", "site", "/@manage/settings/preview", BsCameraFill, [
    "预览",
    "播放器",
    "视频",
    "音频",
    "图片",
    "字幕",
    "自动播放",
    "preview",
    "video",
    "audio",
    "image",
    "player",
    "subtitle",
    "autoplay",
    "office",
    "pdf",
    "text types",
  ]),
  item("other", "site", "/@manage/settings/other", BsMedium, [
    "其他",
    "离线下载",
    "任务线程",
    "aria2",
    "qbittorrent",
    "transmission",
    "other",
    "offline download",
    "task threads",
    "copy task",
    "upload task",
    "decompress",
  ]),

  // Storage and transfer
  item("storages", "storage", "/@manage/storages", CgDatabase, [
    "存储",
    "添加存储",
    "挂载",
    "网盘",
    "驱动",
    "storage",
    "mount",
    "driver",
    "drive",
    "add storage",
  ]),
  item(
    "shares",
    "storage",
    "/@manage/shares",
    CgShare,
    ["分享", "分享链接", "共享", "share", "shares", "share link", "sharing"],
    { permission: "general" },
  ),
  item("traffic", "storage", "/@manage/settings/traffic", BsArrowLeftRight, [
    "流量",
    "限速",
    "带宽",
    "下载限速",
    "上传限速",
    "traffic",
    "bandwidth",
    "rate limit",
    "speed limit",
    "download speed",
    "upload speed",
    "stream",
  ]),
  item("s3", "storage", "/@manage/settings/s3", BsBucket, [
    "对象存储",
    "存储桶",
    "s3",
    "bucket",
    "buckets",
    "access key",
    "secret key",
  ]),
  item("ftp", "storage", "/@manage/settings/ftp", BsHddNetwork, [
    "ftp",
    "sftp",
    "被动端口",
    "ftp 服务",
    "passive port",
    "tls",
    "ftp server",
  ]),
  item(
    "transfers",
    "storage",
    "/@transfers",
    TbArrowsUpDown,
    [
      "传输",
      "任务",
      "同步",
      "同步作业",
      "复制",
      "移动",
      "上传",
      "下载",
      "离线下载",
      "transfers",
      "tasks",
      "task center",
      "sync",
      "sync job",
      "copy",
      "move",
      "upload",
      "download",
    ],
    { permission: "general" },
  ),

  // Indexing and background jobs
  item("indexes", "indexing", "/@manage/indexes", BsSearch, [
    "索引",
    "搜索",
    "重建索引",
    "index",
    "indexes",
    "search",
    "build index",
    "auto update index",
    "elasticsearch",
    "meilisearch",
    "database",
  ]),

  // Authentication and access
  item(
    "users",
    "access",
    "/@manage/users",
    BsPersonCircle,
    [
      "用户",
      "账户",
      "账号",
      "权限",
      "角色",
      "密码",
      "users",
      "user",
      "account",
      "permission",
      "role",
      "password",
      "webdav",
      "two factor",
      "2fa",
    ],
    { permission: "user_admin" },
  ),
  item("metas", "access", "/@manage/metas", SiMetabase, [
    "元信息",
    "目录密码",
    "隐藏文件",
    "说明文件",
    "metas",
    "meta",
    "folder password",
    "hide files",
    "readme",
    "header",
  ]),
  item("sso", "access", "/@manage/settings/sso", FiLogIn, [
    "单点登录",
    "第三方登录",
    "sso",
    "oidc",
    "oauth",
    "github",
    "google",
    "gitee",
    "microsoft",
    "dingtalk",
    "casdoor",
    "client id",
    "client secret",
    "login",
  ]),
  item("ldap", "access", "/@manage/settings/ldap", FiLogIn, [
    "ldap",
    "目录服务",
    "域账号",
    "ldap server",
    "bind dn",
    "manager dn",
    "user search",
  ]),

  // Extensions and cluster
  item("plugins", "extensions", "/@manage/plugins", BsPlugin, [
    "插件",
    "扩展",
    "plugins",
    "plugin",
    "extension",
    "wasm",
    "install plugin",
  ]),
  item("cluster", "extensions", "/@manage/plugins#cluster", TbTopologyStar3, [
    "集群",
    "节点",
    "存储共享",
    "cluster",
    "node",
    "peer",
    "storage sharing",
    "replication",
  ]),

  // System maintenance
  item("global", "system", "/@manage/settings/global", BsJoystick, [
    "全局",
    "全局设置",
    "签名",
    "链接有效期",
    "隐藏",
    "global",
    "sign all",
    "link expiration",
    "hide files",
    "webauthn",
    "ocr",
    "privacy",
    "filename char mapping",
    "ignore system files",
  ]),
  item("dashboard", "system", "/@manage/dashboard", BsSpeedometer2, [
    "仪表盘",
    "概览",
    "状态",
    "监控",
    "dashboard",
    "overview",
    "status",
    "monitor",
    "stats",
  ]),
  item("backup-restore", "system", "/@manage/backup-restore", FaSolidDatabase, [
    "备份",
    "恢复",
    "导出",
    "导入",
    "backup",
    "restore",
    "export",
    "import",
    "migrate",
  ]),
  item(
    "about",
    "system",
    "/@manage/about",
    BsFront,
    ["关于", "版本", "许可", "about", "version", "license", "update"],
    { permission: "guest" },
  ),
  item(
    "docs",
    "system",
    "https://doc.oplist.org",
    FaSolidBook,
    ["文档", "帮助", "手册", "docs", "documentation", "help", "manual", "wiki"],
    { permission: "guest", external: true },
  ),
]

type Subject = Pick<User, "role" | "permission">

/** Same rules the old sidebar used, in one place. */
export const canAccess = (
  permission: SettingPermission | undefined,
  user: Subject,
): boolean => {
  if (user.role === UserRole.ADMIN) return true
  switch (permission ?? "admin") {
    case "guest":
      return true
    case "general":
      return user.role === UserRole.GENERAL
    case "user_admin":
      return UserMethods.can_manage_user_info(user as User)
    default:
      return false
  }
}

export const visibleSettings = (
  user: Subject,
  all: readonly SettingContribution[] = SETTINGS,
): SettingContribution[] => all.filter((s) => canAccess(s.permission, user))

export interface SettingsSection {
  id: SettingGroupId
  title: string
  items: SettingContribution[]
}

/** Groups in display order; a group with nothing visible is left out. */
export const groupSettings = (
  items: readonly SettingContribution[],
): SettingsSection[] =>
  SETTING_GROUPS.map((g) => ({
    ...g,
    items: items.filter((s) => s.group === g.id),
  })).filter((g) => g.items.length > 0)

/** Route without its #hash: what the router matches against. */
export const routePath = (route: string): string => route.split("#")[0]

/** The /@manage sub-path of an entry (without the hash), if it lives there. */
export const manageSubPath = (route: string): string | undefined => {
  const p = routePath(route)
  return p.startsWith("/@manage/") ? p.slice("/@manage".length) : undefined
}
