import { Component, lazy, Show } from "solid-js"
import { Forbidden } from "~/features/shell/states"
import {
  canAccess,
  manageSubPath,
  SETTINGS,
  visibleSettings,
  type SettingPermission,
} from "~/features/settings/registry"
import { SettingsHome } from "~/features/settings/SettingsHome"
import { me } from "~/store"
import { PROFILE_PATH, routeComponents } from "./route-components"

interface Route {
  /** Path below /@manage; "" is the index. */
  to: string
  component: Component
}

const hide_routes: Route[] = [
  {
    to: "/storages/add",
    component: lazy(() => import("./storages/AddOrEdit")),
  },
  {
    to: "/storages/edit/:id",
    component: lazy(() => import("./storages/AddOrEdit")),
  },
  {
    to: "/shares/add",
    component: lazy(() => import("./shares/AddOrEdit")),
  },
  {
    to: "/shares/edit/:id",
    component: lazy(() => import("./shares/AddOrEdit")),
  },
  {
    to: "/users/add",
    component: lazy(() => import("./users/AddOrEdit")),
  },
  {
    to: "/users/edit/:id",
    component: lazy(() => import("./users/AddOrEdit")),
  },
  {
    to: "/metas/add",
    component: lazy(() => import("./metas/AddOrEdit")),
  },
  {
    to: "/metas/edit/:id",
    component: lazy(() => import("./metas/AddOrEdit")),
  },
  {
    to: "/2fa",
    component: lazy(() => import("./users/2fa")),
  },
  {
    to: "/messenger",
    component: lazy(() => import("./messenger/Messenger")),
  },
]

/** Settings landing page: the registry, filtered to what this user may open. */
const SettingsIndex = () => <SettingsHome items={visibleSettings(me())} />

/** A page the user lacks permission for shows Forbidden instead of the page. */
const guarded = (permission: SettingPermission | undefined, Page: Component) => () => (
  <Show when={canAccess(permission, me())} fallback={<Forbidden />}>
    <Page />
  </Show>
)

const get_routes = (): Route[] => {
  const acc = new Map<string, Route>()
  acc.set("", { to: "", component: SettingsIndex })
  // Profile left the settings list for the account menu but keeps its page.
  acc.set(PROFILE_PATH, {
    to: PROFILE_PATH,
    component: routeComponents[PROFILE_PATH],
  })
  for (const entry of SETTINGS) {
    const sub = manageSubPath(entry.route)
    // Entries that share a page (plugins / cluster) register it once.
    if (!sub || acc.has(sub)) continue
    acc.set(sub, {
      to: sub,
      component: guarded(entry.permission, routeComponents[sub]),
    })
  }
  return [...acc.values()]
}

const routes = get_routes().concat(hide_routes)
export { routes }
