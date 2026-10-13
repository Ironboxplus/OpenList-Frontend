// The library: every scraped item the user may see, as a poster wall with a
// type filter in the URL (?kind=). Only video kinds exist: the backend has no
// music, pictures or books, so there is nothing to list for them; add their
// chips when it does.
import { useSearchParams } from "@solidjs/router"
import { createEffect, For, on, Show } from "solid-js"
import { Button } from "~/components/ui/button"
import { ChipTabs } from "~/components/ui/chip-tabs"
import { DataState } from "~/components/ui/data-state"
import { useRouter, useT, useTitle } from "~/hooks"
import { getSettingBool, me } from "~/store"
import { UserMethods } from "~/types"
import { api } from "~/utils/config"
import { library } from "./client"
import {
  createLibraryList,
  isLibraryFilter,
  LIBRARY_FILTERS,
  type LibraryFilter,
} from "./library-list"
import { MediaPosterCard } from "./MediaPosterCard"

const LibraryPage = () => {
  const t = useT()
  useTitle(() => t("shell.nav.media"))
  const { to } = useRouter()
  const [params, setParams] = useSearchParams()
  const list = createLibraryList(library)

  const filter = (): LibraryFilter => {
    const v = Array.isArray(params.kind) ? params.kind[0] : params.kind
    return isLibraryFilter(v) ? v : "all"
  }
  const enabled = () => getSettingBool("media_enabled")
  createEffect(
    on([filter, enabled], ([f, on]) => {
      if (on) void list.load(f)
    }),
  )

  const label = (f: LibraryFilter) =>
    f === "all" ? t("media.page.all") : t(`media.kind.${f}`)
  // A failure with nothing on screen is the page's state; with items on screen
  // it belongs next to the "load more" button.
  const firstError = () =>
    list.items().length === 0 ? list.error() : undefined

  return (
    <div class="mx-auto flex w-full max-w-[1600px] flex-col gap-4 p-4 sm:p-6">
      <h1 class="text-xl font-semibold">{t("shell.nav.media")}</h1>
      <Show
        when={enabled()}
        fallback={
          <p
            data-testid="media-disabled"
            class="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground"
          >
            {t("media.page.disabled")}
          </p>
        }
      >
        <ChipTabs
          label={t("media.page.filter")}
          items={LIBRARY_FILTERS.map((f) => ({ key: f, label: label(f) }))}
          value={filter()}
          onChange={(f) =>
            setParams({ kind: f === "all" ? undefined : f }, { replace: true })
          }
        />
        <DataState
          loading={list.loading() && !list.loaded()}
          error={firstError()}
          onRetry={() => void list.retry()}
          empty={list.loaded() ? list.items().length === 0 : undefined}
          emptyText={t("media.page.empty")}
          emptyAction={
            <Show when={UserMethods.is_admin(me())}>
              <p class="max-w-prose">{t("media.page.empty_admin")}</p>
              <Button variant="outline" onClick={() => to("/")}>
                {t("media.page.empty_admin_action")}
              </Button>
            </Show>
          }
          skeletonRows={4}
        >
          <div
            data-testid="library-grid"
            class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
          >
            <For each={list.items()}>
              {(card) => (
                <MediaPosterCard
                  card={card}
                  collectionTag={t("media.kind.collection")}
                  apiBase={api}
                />
              )}
            </For>
          </div>
          <Show when={list.hasMore() || list.error()}>
            <div class="flex flex-col items-center gap-2">
              <Show when={list.error()}>
                <p role="alert" class="text-sm text-destructive">
                  {t("media.page.more_failed")} {list.error()}
                </p>
              </Show>
              <Button
                variant="outline"
                data-testid="library-more"
                disabled={list.loading()}
                onClick={() => void list.loadMore()}
              >
                {t("media.page.more")}
              </Button>
            </div>
          </Show>
        </DataState>
      </Show>
    </div>
  )
}

export default LibraryPage
