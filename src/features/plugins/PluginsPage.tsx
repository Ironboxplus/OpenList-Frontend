// The plugins this browser runs: which ones are on and where they show up.
// Installing, removing and switching the server's own plugins is a settings
// matter (Settings > Extensions); this page only links to it, for admins.
import { createMemo, For, Show } from "solid-js"
import { Card } from "~/components/ui/card"
import { DataState } from "~/components/ui/data-state"
import { Switch, SwitchControl, SwitchThumb } from "~/components/ui/switch"
import { useT, useTitle } from "~/hooks"
import { plugins, setPluginEnabled } from "~/plugins/registry"
import { me } from "~/store"
import { UserMethods } from "~/types"
import { NavLink } from "../shell/NavLink"
import { useTopBarSlots } from "../shell/topbar-slot"
import { pluginRows } from "./model"

const PluginsPage = () => {
  const t = useT()
  useTitle(() => t("shell.nav.plugins"))
  const rows = createMemo(() => pluginRows(plugins()))
  useTopBarSlots(() => ({
    right: () => (
      <Show when={UserMethods.is_admin(me())}>
        <NavLink
          path="/@manage/plugins"
          data-testid="system-plugins-link"
          class="mr-2 whitespace-nowrap text-sm text-primary underline-offset-4 hover:underline"
        >
          {t("plugins.page.manage_system")}
        </NavLink>
      </Show>
    ),
  }))
  return (
    <div class="mx-auto flex w-full max-w-[1000px] flex-col gap-4 p-4 sm:p-6">
      <h1 class="sr-only">{t("shell.nav.plugins")}</h1>
      <p class="m-0 text-sm text-muted-foreground">
        {t("plugins.page.browser_only")}
      </p>
      <DataState
        empty={rows().length === 0}
        emptyText={t("plugins.page.empty")}
      >
        <ul class="m-0 flex list-none flex-col gap-3 p-0">
          <For each={rows()}>
            {(row) => (
              <li>
                <Card
                  data-testid="plugin-row"
                  data-plugin={row.id}
                  class="flex items-center gap-3 p-4"
                >
                  <div class="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span class="truncate font-medium">{row.name}</span>
                    <span class="truncate text-xs text-muted-foreground">
                      {row.id}
                      <Show when={row.version}>
                        {(v) => (
                          <>
                            {" · "}
                            {t("plugins.page.version", { version: v() })}
                          </>
                        )}
                      </Show>
                    </span>
                    <span class="text-xs text-muted-foreground">
                      {t("plugins.page.contributes")}: {row.slots.join(", ")}
                    </span>
                  </div>
                  <Switch
                    checked={row.enabled}
                    onChange={(on) => setPluginEnabled(row.id, on)}
                  >
                    <SwitchControl
                      data-plugin-toggle={row.id}
                      aria-label={t("plugins.page.toggle", { name: row.name })}
                    >
                      <SwitchThumb />
                    </SwitchControl>
                  </Switch>
                </Card>
              </li>
            )}
          </For>
        </ul>
      </DataState>
    </div>
  )
}

export default PluginsPage
