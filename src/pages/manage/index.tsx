import { Route, Routes, useLocation } from "@solidjs/router"
import { createMemo, For } from "solid-js"
import { useRouter, useT, useTitle } from "~/hooks"
import { SettingsNav } from "~/features/settings/SettingsNav"
import { SettingsTopLeft } from "~/features/settings/SettingsTopLeft"
import { groupSettings, visibleSettings } from "~/features/settings/registry"
import { NotFound } from "~/features/shell/states"
import { useTopBarSlots } from "~/features/shell/topbar-slot"
import { me } from "~/store"
import { getRoutes } from "./routes"
import { StorageLoadingBar } from "./StorageLoadingBar"

/**
 * The settings area inside the app shell. The shell provides the
 * primary navigation (and the phone's back bar), so this is only the secondary
 * settings nav and the page content.
 */
const Manage = () => {
  const t = useT()
  useTitle(() => t("manage.title"))
  const { pathname } = useRouter()
  const location = useLocation()
  const routes = getRoutes()
  const sections = createMemo(() => groupSettings(visibleSettings(me())))
  useTopBarSlots(() => ({
    left: (ctx) => (
      <SettingsTopLeft
        pathname={pathname()}
        hash={location.hash}
        phone={ctx.phone}
      />
    ),
  }))

  return (
    <div class="w-full bg-background">
      <div
        class="flex w-full items-start"
        style={{
          "min-height":
            "calc(100dvh - var(--shell-top, 0px) - var(--shell-gap, 0px) - 2px)",
        }}
      >
        <SettingsNav
          sections={sections()}
          pathname={pathname()}
          hash={location.hash}
        />
        <main class="min-w-0 flex-1 p-4">
          <StorageLoadingBar />
          <Routes>
            <For each={routes}>
              {(route) => <Route path={route.to} component={route.component} />}
            </For>
            <Route path="*" component={NotFound} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

export default Manage
