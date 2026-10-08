import { Box } from "@hope-ui/solid"
import { Route, Routes, useLocation } from "@solidjs/router"
import { createMemo, createSignal, For } from "solid-js"
import { useRouter, useT, useTitle } from "~/hooks"
import {
  readNavCollapsed,
  SettingsNav,
  writeNavCollapsed,
} from "~/features/settings/SettingsNav"
import { SettingsTopLeft } from "~/features/settings/SettingsTopLeft"
import { groupSettings, visibleSettings } from "~/features/settings/registry"
import { NotFound } from "~/features/shell/states"
import { useTopBarSlots } from "~/features/shell/topbar-slot"
import { me } from "~/store"
import { routes } from "./routes"
import { StorageLoadingBar } from "./StorageLoadingBar"

/**
 * The settings area inside the app shell. The shell already provides the
 * header (TopBar with the breadcrumb) and the primary navigation, so this is
 * only the secondary settings nav (wide screens) and the page content.
 */
const Manage = () => {
  const t = useT()
  useTitle(() => t("manage.title"))
  const { pathname } = useRouter()
  const location = useLocation()
  const sections = createMemo(() => groupSettings(visibleSettings(me())))
  const [collapsed, setCollapsed] = createSignal(readNavCollapsed(localStorage))
  const toggle = () => {
    const next = !collapsed()
    setCollapsed(next)
    writeNavCollapsed(localStorage, next)
  }

  useTopBarSlots(() => ({
    left: (ctx) => (
      <SettingsTopLeft
        phone={ctx.phone}
        pathname={pathname()}
        hash={location.hash}
      />
    ),
  }))

  return (
    <Box
      css={{
        "--hope-colors-background": "var(--hope-colors-loContrast)",
      }}
      bgColor="$background"
      w="$full"
    >
      <div
        class="flex w-full items-start"
        style={{ "min-height": "calc(100vh - var(--shell-top, 0px))" }}
      >
        <SettingsNav
          sections={sections()}
          pathname={pathname()}
          hash={location.hash}
          collapsed={collapsed()}
          onToggle={toggle}
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
    </Box>
  )
}

export default Manage
