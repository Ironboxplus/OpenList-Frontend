import { TbArrowLeft } from "solid-icons/tb"
import { Show } from "solid-js"
import { focusRing } from "~/components/ui/focus"
import { useRouter, useT } from "~/hooks"
import { cn } from "~/utils/cn"
import { joinBase } from "~/utils/path"
import { settingsCrumbs, SETTINGS_HOME } from "./crumbs"

/**
 * Phone TopBar content for /@manage pages: back to the settings home plus the
 * page title. Tablet and desktop have no TopBar on the settings pages (the
 * settings menu and the page's own title say where you are).
 */
export const SettingsTopLeft = (props: { pathname: string; hash: string }) => {
  const t = useT()
  const { to } = useRouter()
  const crumbs = () => settingsCrumbs(props.pathname, props.hash)
  const go = (href: string) => (e: MouseEvent) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return
    e.preventDefault()
    to(href)
  }
  return (
    <div class="flex min-w-0 items-center gap-1">
      <Show when={crumbs().length > 1}>
        <a
          href={joinBase(SETTINGS_HOME)}
          aria-label={t("settings.nav.back")}
          data-settings-back
          onClick={go(SETTINGS_HOME)}
          class={cn(
            focusRing,
            "no-underline hover:no-underline",
            "inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent",
          )}
        >
          <TbArrowLeft class="size-5" />
        </a>
      </Show>
      <span class="truncate text-sm font-medium text-foreground">
        {t(crumbs()[crumbs().length - 1].key)}
      </span>
    </div>
  )
}
