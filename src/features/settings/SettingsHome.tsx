import { TbExternalLink, TbSearch, TbX } from "solid-icons/tb"
import { createMemo, createSignal, For, Show } from "solid-js"
import { Dynamic } from "solid-js/web"
import { Card } from "~/components/ui/card"
import { focusRing } from "~/components/ui/focus"
import { useRouter, useT } from "~/hooks"
import { rankAll } from "../palette/rank"
import { cardKeys, LAYOUT_PAGES } from "./layouts"
import { openSetting } from "./open"
import { groupSettings, type SettingContribution } from "./registry"
import { joinBase } from "~/utils/path"
import { cn } from "~/utils/cn"

const SettingCard = (props: { entry: SettingContribution }) => {
  const t = useT()
  const { to } = useRouter()
  return (
    <a
      href={
        props.entry.external ? props.entry.route : joinBase(props.entry.route)
      }
      target={props.entry.external ? "_blank" : undefined}
      rel={props.entry.external ? "noopener noreferrer" : undefined}
      data-setting={props.entry.id}
      class={cn("block rounded-xl no-underline hover:no-underline", focusRing)}
      onClick={(e) => {
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return
        e.preventDefault()
        openSetting(props.entry, to)
      }}
    >
      <Card class="flex h-full items-start gap-3 p-4 transition-colors hover:bg-accent">
        <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
          <Dynamic component={props.entry.icon} class="size-5" />
        </span>
        <span class="min-w-0 flex-1">
          <span class="flex items-center gap-1.5 text-sm font-medium text-foreground">
            {t(props.entry.title)}
            <Show when={props.entry.external}>
              <TbExternalLink
                class="size-3.5 text-muted-foreground"
                aria-label={t("settings.home.external")}
              />
            </Show>
          </span>
          <span class="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">
            {t(props.entry.description)}
          </span>
        </span>
      </Card>
    </a>
  )
}

/** At most this many single settings are listed for a query. */
const HITS = 8

/**
 * Landing page of /@manage: one titled block per group, a card per page, and
 * a search box that filters with the same matcher as the command palette, and
 * lists the single settings it finds, folded ones too (research 05 §二.4).
 * `items` is already permission-filtered by the caller.
 */
export const SettingsHome = (props: { items: SettingContribution[] }) => {
  const t = useT()
  const { to } = useRouter()
  const [query, setQuery] = createSignal("")
  // the single settings of the pages laid out in cards (layouts.ts), by
  // their names and keys: a hit leads to the page, which opens its group
  const settingsOf = (entry: SettingContribution) =>
    cardKeys(LAYOUT_PAGES[entry.id] ?? []).map((key) => ({
      entry,
      key,
      title: t(`settings.${key}`),
      keywords: [key],
    }))
  const searchable = createMemo(() =>
    props.items.map((entry) => ({
      entry,
      title: t(entry.title),
      keywords: [
        ...entry.keywords,
        t(entry.description),
        ...settingsOf(entry).map((s) => s.title),
      ],
    })),
  )
  const sections = createMemo(() =>
    groupSettings(rankAll(query(), searchable()).map((r) => r.entry)),
  )
  const hits = createMemo(() =>
    query().trim()
      ? rankAll(query(), props.items.flatMap(settingsOf)).slice(0, HITS)
      : [],
  )
  const hitRoute = (hit: { entry: SettingContribution; key: string }) =>
    `${hit.entry.route}?focus=${encodeURIComponent(hit.key)}`
  return (
    <div class="mx-auto flex w-full max-w-5xl flex-col gap-6 pb-8">
      {/* The TopBar crumb is the visible title (as on Files); keep it for screen readers. */}
      <header class="flex flex-col gap-1">
        <h1 class="sr-only">{t("settings.home.title")}</h1>
        <p class="text-sm text-muted-foreground">
          {t("settings.home.subtitle")}
        </p>
      </header>

      <div class="relative">
        <TbSearch class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          role="searchbox"
          aria-label={t("settings.home.search")}
          placeholder={t("settings.home.search_placeholder")}
          value={query()}
          onInput={(e) => setQuery(e.currentTarget.value)}
          class={cn(
            "h-10 w-full rounded-md border border-input bg-background pl-9 pr-9 text-sm text-foreground placeholder:text-muted-foreground",
            focusRing,
          )}
        />
        <Show when={query() !== ""}>
          <button
            type="button"
            aria-label={t("settings.home.clear")}
            class={cn(
              "absolute right-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded bg-transparent text-muted-foreground hover:text-foreground",
              focusRing,
            )}
            onClick={() => setQuery("")}
          >
            <TbX class="size-4" />
          </button>
        </Show>
      </div>

      <Show when={hits().length > 0}>
        <section data-setting-hits class="flex flex-col gap-2">
          <h2 class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("settings.layout.hits")}
          </h2>
          <Card class="flex flex-col divide-y divide-border p-0">
            <For each={hits()}>
              {(hit) => (
                <a
                  data-setting-hit={hit.key}
                  href={joinBase(hitRoute(hit))}
                  class={cn(
                    "flex items-baseline justify-between gap-3 px-4 py-2.5 text-sm no-underline hover:bg-accent hover:no-underline",
                    focusRing,
                  )}
                  onClick={(e) => {
                    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey)
                      return
                    e.preventDefault()
                    to(hitRoute(hit))
                  }}
                >
                  <span class="min-w-0 truncate font-medium text-foreground">
                    {hit.title}
                  </span>
                  <span class="shrink-0 text-xs text-muted-foreground">
                    {t(hit.entry.title)}
                  </span>
                </a>
              )}
            </For>
          </Card>
        </section>
      </Show>

      <Show
        when={sections().length > 0}
        fallback={
          <p
            class="py-10 text-center text-sm text-muted-foreground"
            data-testid="settings-empty"
          >
            {t("settings.home.no_results", { query: query() })}
          </p>
        }
      >
        <For each={sections()}>
          {(section) => (
            <section class="flex flex-col gap-3" data-group={section.id}>
              <h2 class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t(section.title)}
              </h2>
              <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <For each={section.items}>
                  {(entry) => <SettingCard entry={entry} />}
                </For>
              </div>
            </section>
          )}
        </For>
      </Show>
    </div>
  )
}
