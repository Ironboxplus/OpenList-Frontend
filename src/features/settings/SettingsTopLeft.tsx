import { TbArrowLeft } from "solid-icons/tb"
import { Show } from "solid-js"
import { focusRing } from "~/components/ui/focus"
import { useRouter, useT } from "~/hooks"
import { cn } from "~/utils/cn"
import { joinBase } from "~/utils/path"
import { Breadcrumb } from "../shell/Breadcrumb"
import { settingsCrumbs, SETTINGS_HOME } from "./crumbs"

/**
 * TopBar content for /@manage pages. Tablet and desktop: the same breadcrumb as
 * Files (Settings > group > page). Phone: back to the settings home plus the
 * page title.
 */
export const SettingsTopLeft = (props: {
  pathname: string
  hash: string
  phone?: boolean
}) => {
  const t = useT()
  const { to } = useRouter()
  const crumbs = () => settingsCrumbs(props.pathname, props.hash)
  const go = (href: string) => (e: MouseEvent) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return
    e.preventDefault()
    to(href)
  }
  return (
    <Show
      when={props.phone}
      fallback={
        <Breadcrumb
          attrs={{ "data-settings-crumbs": "" }}
          items={crumbs().map((c, i, all) => ({
            href: c.href,
            // A deeper page (add/edit) has no crumb of its own: its page
            // crumb is a link back and the last crumb is current only when
            // it has no href.
            current: i === all.length - 1 && !c.href,
            label: <span>{t(c.key)}</span>,
          }))}
          onNavigate={to}
        />
      }
    >
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
    </Show>
  )
}
