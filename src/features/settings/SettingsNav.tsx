import { For, Show } from "solid-js"
import { Dynamic } from "solid-js/web"
import { focusRing } from "~/components/ui/focus"
import { useRouter, useT } from "~/hooks"
import { cn } from "~/utils/cn"
import { joinBase } from "~/utils/path"
import { entryFor, isSettingsHome } from "./crumbs"
import { openSetting } from "./open"
import type { SettingContribution, SettingsSection } from "./registry"

/**
 * Secondary navigation of the settings area (not on phones): the registry
 * groups and pages, icon-only below 1280px and with labels from there on. The
 * shell sidebar is the primary nav and the only thing the user folds, so
 * there is no "Settings" row nor a fold button in here. The landing page
 * lists every page itself, so the nav is left out there.
 */
export const SettingsNav = (props: {
  sections: SettingsSection[]
  pathname: string
  hash: string
}) => {
  const t = useT()
  const { to } = useRouter()
  const activeId = () => entryFor(props.pathname, props.hash)?.id
  const Item = (p: { entry: SettingContribution }) => (
    <a
      href={p.entry.external ? p.entry.route : joinBase(p.entry.route)}
      target={p.entry.external ? "_blank" : undefined}
      rel={p.entry.external ? "noopener noreferrer" : undefined}
      title={t(p.entry.title)}
      aria-label={t(p.entry.title)}
      aria-current={activeId() === p.entry.id ? "page" : undefined}
      data-settings-nav-item={p.entry.id}
      class={cn(
        focusRing,
        "flex h-8 items-center gap-2 rounded-md px-2 text-sm text-muted-foreground no-underline transition-colors hover:bg-accent hover:text-accent-foreground hover:no-underline",
        "justify-center px-0 xl:justify-start xl:px-2",
        activeId() === p.entry.id && "bg-accent font-medium text-foreground",
      )}
      onClick={(e) => {
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return
        e.preventDefault()
        openSetting(p.entry, to)
      }}
    >
      <Dynamic component={p.entry.icon} class="size-4 shrink-0" />
      <span class="hidden truncate xl:inline">{t(p.entry.title)}</span>
    </a>
  )
  return (
    <Show when={!isSettingsHome(props.pathname)}>
      <nav
        aria-label={t("settings.nav.label")}
        data-settings-nav
        class={cn(
          "sticky hidden w-14 shrink-0 flex-col gap-3 overflow-y-auto border-r bg-card p-2 text-card-foreground sm:flex xl:w-[220px]",
        )}
        style={{
          top: "var(--shell-top, 0px)",
          height:
            "calc(100dvh - var(--shell-top, 0px) - var(--shell-gap, 0px))",
        }}
      >
        <div class="flex flex-1 flex-col gap-3">
          <For each={props.sections}>
            {(section) => (
              <section class="flex flex-col gap-0.5">
                <hr class="mx-2 border-border first:hidden xl:hidden" />
                <h2 class="hidden px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground xl:block">
                  {t(section.title)}
                </h2>
                <For each={section.items}>
                  {(entry) => <Item entry={entry} />}
                </For>
              </section>
            )}
          </For>
        </div>
      </nav>
    </Show>
  )
}
