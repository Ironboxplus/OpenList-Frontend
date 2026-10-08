import {
  TbLayoutSidebarLeftCollapse,
  TbLayoutSidebarLeftExpand,
} from "solid-icons/tb"
import { For, Show } from "solid-js"
import { Dynamic } from "solid-js/web"
import { focusRing } from "~/components/ui/focus"
import { useRouter, useT } from "~/hooks"
import { cn } from "~/utils/cn"
import { joinBase } from "~/utils/path"
import { entryFor } from "./crumbs"
import { openSetting } from "./open"
import type { SettingContribution, SettingsSection } from "./registry"

export const SETTINGS_NAV_KEY = "settings-nav-collapsed"
export const readNavCollapsed = (s: Pick<Storage, "getItem">) =>
  s.getItem(SETTINGS_NAV_KEY) === "1"
export const writeNavCollapsed = (s: Pick<Storage, "setItem">, v: boolean) =>
  s.setItem(SETTINGS_NAV_KEY, v ? "1" : "0")

/**
 * Secondary navigation of the settings area (1280px and wider only): the
 * registry groups and pages. The shell sidebar is the primary nav, so there
 * is no "Settings" row in here; the breadcrumb leads back to the settings home.
 */
export const SettingsNav = (props: {
  sections: SettingsSection[]
  pathname: string
  hash: string
  collapsed: boolean
  onToggle: () => void
}) => {
  const t = useT()
  const { to } = useRouter()
  const activeId = () => entryFor(props.pathname, props.hash)?.id
  const Item = (p: { entry: SettingContribution }) => (
    <a
      href={p.entry.external ? p.entry.route : joinBase(p.entry.route)}
      target={p.entry.external ? "_blank" : undefined}
      rel={p.entry.external ? "noopener noreferrer" : undefined}
      title={props.collapsed ? t(p.entry.title) : undefined}
      aria-label={props.collapsed ? t(p.entry.title) : undefined}
      aria-current={activeId() === p.entry.id ? "page" : undefined}
      data-settings-nav-item={p.entry.id}
      class={cn(
        focusRing,
        "flex h-8 items-center gap-2 rounded-md px-2 text-sm text-muted-foreground no-underline transition-colors hover:bg-accent hover:text-accent-foreground hover:no-underline",
        props.collapsed && "justify-center px-0",
        activeId() === p.entry.id && "bg-accent font-medium text-foreground",
      )}
      onClick={(e) => {
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return
        e.preventDefault()
        openSetting(p.entry, to)
      }}
    >
      <Dynamic component={p.entry.icon} class="size-4 shrink-0" />
      <Show when={!props.collapsed}>
        <span class="truncate">{t(p.entry.title)}</span>
      </Show>
    </a>
  )
  return (
    <nav
      aria-label={t("settings.nav.label")}
      data-settings-nav
      class={cn(
        "sticky hidden shrink-0 flex-col gap-3 overflow-y-auto border-r bg-card p-2 text-card-foreground xl:flex",
        props.collapsed ? "w-14" : "w-[220px]",
      )}
      style={{
        top: "var(--shell-top, 0px)",
        height: "calc(100vh - var(--shell-top, 0px))",
      }}
    >
      <button
        type="button"
        onClick={props.onToggle}
        aria-label={t(
          props.collapsed ? "settings.nav.expand" : "settings.nav.collapse",
        )}
        aria-expanded={!props.collapsed}
        class={cn(
          focusRing,
          "flex h-8 items-center gap-2 rounded-md bg-transparent px-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground",
          props.collapsed && "justify-center px-0",
        )}
      >
        <Show
          when={props.collapsed}
          fallback={<TbLayoutSidebarLeftCollapse class="size-4 shrink-0" />}
        >
          <TbLayoutSidebarLeftExpand class="size-4 shrink-0" />
        </Show>
        <Show when={!props.collapsed}>
          <span class="truncate">{t("settings.nav.collapse")}</span>
        </Show>
      </button>
      <div class="flex flex-1 flex-col gap-3">
        <For each={props.sections}>
          {(section) => (
            <section class="flex flex-col gap-0.5">
              <Show
                when={!props.collapsed}
                fallback={<hr class="mx-2 border-border first:hidden" />}
              >
                <h2 class="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {t(section.title)}
                </h2>
              </Show>
              <For each={section.items}>
                {(entry) => <Item entry={entry} />}
              </For>
            </section>
          )}
        </For>
      </div>
    </nav>
  )
}
