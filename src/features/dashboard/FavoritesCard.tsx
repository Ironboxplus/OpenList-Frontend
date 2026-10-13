import { TbBell, TbBookmark, TbFile, TbFolder } from "solid-icons/tb"
import { For, Show } from "solid-js"
import { DataState } from "~/components/ui/data-state"
import { focusRing } from "~/components/ui/focus"
import { useRouter, useT } from "~/hooks"
import { fetchFavorites } from "~/plugins/builtin/favorites/api"
import type { Favorite } from "~/plugins/builtin/favorites/data"
import { cn } from "~/utils/cn"
import { createLoad } from "~/utils/load"
import { errorCenter } from "../notifications/service"
import { setErrorCenterOpen } from "../notifications/state"
import { DashboardCard } from "./DashboardCard"
import { topFavorites } from "./summary"

const load = async (top?: number): Promise<Favorite[]> => {
  const resp = await fetchFavorites()
  if (resp.code !== 200) throw new Error(resp.message || `HTTP ${resp.code}`)
  return topFavorites(resp.data ?? [], top)
}

/**
 * `top` caps the list; `withErrors` adds the unread error count underneath
 * (the admin layout has one card for both).
 */
export const FavoritesCard = (props: {
  top?: number
  withErrors?: boolean
  class?: string
}) => {
  const t = useT()
  const { to } = useRouter()
  const favs = createLoad(() => props.top, load)
  const message = () => {
    const e = favs.error()
    return e ? (e instanceof Error ? e.message : String(e)) : undefined
  }
  return (
    <DashboardCard
      testid="dashboard-favorites"
      title={t("dashboard.favorites.title")}
      icon={TbBookmark}
      onOpen={() => to("/")}
      class={props.class}
    >
      <DataState
        loading={favs.loading()}
        error={message()}
        onRetry={() => void favs.refetch()}
        empty={
          !favs.loading() && !favs.error() && (favs.data() ?? []).length === 0
        }
        emptyText={t("dashboard.favorites.empty")}
      >
        <ul class="m-0 flex list-none flex-col gap-1 p-0">
          <For each={favs.data()}>
            {(fav) => (
              <li>
                <button
                  type="button"
                  data-testid="dashboard-favorite"
                  onClick={() => to(fav.path)}
                  class={cn(
                    focusRing,
                    "flex h-9 w-full items-center gap-2 rounded-md bg-transparent px-2 text-left text-sm hover:bg-accent",
                  )}
                >
                  <Show
                    when={fav.is_dir}
                    fallback={
                      <TbFile class="size-4 shrink-0 text-muted-foreground" />
                    }
                  >
                    <TbFolder class="size-4 shrink-0 text-muted-foreground" />
                  </Show>
                  <span class="truncate">{fav.name || fav.path}</span>
                </button>
              </li>
            )}
          </For>
        </ul>
      </DataState>
      <Show when={props.withErrors}>
        <button
          type="button"
          data-testid="dashboard-unread-errors"
          onClick={() => setErrorCenterOpen(true)}
          class={cn(
            focusRing,
            "flex items-center gap-2 rounded-md bg-transparent px-2 py-1 text-left text-xs text-muted-foreground hover:bg-accent",
          )}
        >
          <TbBell class="size-4" />
          {t("dashboard.errors.unread", { count: errorCenter.unreadCount() })}
        </button>
      </Show>
    </DashboardCard>
  )
}
