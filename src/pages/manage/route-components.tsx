// Lazy page components for the /@manage sub-routes. Which entries exist, in
// what order and for whom is the settings registry's business
// (features/settings/registry.ts); this table only says what each path renders.
import { Component, lazy } from "solid-js"
import { Group } from "~/types"

const CommonSettings = lazy(() => import("./settings/Common"))

export const PROFILE_PATH = "/profile"

/** Keyed by the path below /@manage. */
export const routeComponents: Record<string, Component> = {
  [PROFILE_PATH]: lazy(() => import("./users/Profile")),
  "/dashboard": lazy(() => import("./Dashboard")),
  "/settings/site": () => <CommonSettings group={Group.SITE} />,
  "/settings/style": () => <CommonSettings group={Group.STYLE} />,
  "/settings/preview": () => <CommonSettings group={Group.PREVIEW} />,
  "/settings/global": () => <CommonSettings group={Group.GLOBAL} />,
  "/settings/sso": () => <CommonSettings group={Group.SSO} />,
  "/settings/ldap": () => <CommonSettings group={Group.LDAP} />,
  "/settings/s3": lazy(() => import("./settings/S3")),
  "/settings/ftp": () => <CommonSettings group={Group.FTP} />,
  "/settings/traffic": () => <CommonSettings group={Group.TRAFFIC} />,
  "/settings/other": lazy(() => import("./settings/Other")),
  "/users": lazy(() => import("./users/Users")),
  "/storages": lazy(() => import("./storages/Storages")),
  "/shares": lazy(() => import("./shares/Shares")),
  "/plugins": lazy(() => import("./plugins/Plugins")),
  "/metas": lazy(() => import("./metas/Metas")),
  "/indexes": lazy(() => import("./indexes/index_page")),
  "/backup-restore": lazy(() => import("./backup-restore")),
  "/about": lazy(() => import("./About")),
}
