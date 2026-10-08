import { TbArrowLeft, TbChevronRight } from "solid-icons/tb"
import { For, Show } from "solid-js"
import { focusRing } from "~/components/ui/focus"
import { useRouter, useT } from "~/hooks"
import { cn } from "~/utils/cn"
import { joinBase } from "~/utils/path"
import { settingsCrumbs, SETTINGS_HOME } from "./crumbs"

const plain = "no-underline hover:no-underline"

/**
 * TopBar content for /@manage pages. Tablet/desktop: Settings > group > page
 * (Settings leads to the card grid). Phone: back to the settings home plus the
 * page title.
 */
export const SettingsTopLeft = (props: {
  phone: boolean
  pathname: string
  hash: string
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
      when={!props.phone}
      fallback={
        <div class="flex min-w-0 items-center gap-1">
          <Show when={crumbs().length > 1}>
            <a
              href={joinBase(SETTINGS_HOME)}
              aria-label={t("settings.nav.back")}
              data-settings-back
              onClick={go(SETTINGS_HOME)}
              class={cn(
                focusRing,
                plain,
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
      }
    >
      <nav aria-label="breadcrumb" data-settings-crumbs class="min-w-0">
        <ol class="m-0 flex list-none items-center gap-1 p-0 text-sm">
          <For each={crumbs()}>
            {(crumb, i) => (
              <>
                <Show when={i() > 0}>
                  <TbChevronRight class="size-3.5 shrink-0 text-muted-foreground" />
                </Show>
                <li class="min-w-0 truncate">
                  <Show
                    when={crumb.href}
                    fallback={
                      <span
                        aria-current={
                          i() === crumbs().length - 1 ? "page" : undefined
                        }
                        class={
                          i() === crumbs().length - 1
                            ? "font-medium text-foreground"
                            : "text-muted-foreground"
                        }
                      >
                        {t(crumb.key)}
                      </span>
                    }
                  >
                    {(href) => (
                      <a
                        href={joinBase(href())}
                        onClick={go(href())}
                        class={cn(
                          focusRing,
                          plain,
                          "rounded text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {t(crumb.key)}
                      </a>
                    )}
                  </Show>
                </li>
              </>
            )}
          </For>
        </ol>
      </nav>
    </Show>
  )
}
