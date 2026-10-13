import { TbBookmark, TbFile, TbFolder } from "solid-icons/tb"
import { createResource, For, Show } from "solid-js"
import { DataState } from "~/components/ui/data-state"
import { focusRing } from "~/components/ui/focus"
import { useRouter, useT } from "~/hooks"
import { fetchFavorites } from "~/plugins/builtin/favorites/api"
import type { Favorite } from "~/plugins/builtin/favorites/data"
import { cn } from "~/utils/cn"
import { DashboardCard } from "./DashboardCard"
import { topFavorites } from "./summary"

const load = async (): Promise<Favorite[]> => {
  const resp = await fetchFavorites()
  if (resp.code !== 200) throw new Error(resp.message || `HTTP ${resp.code}`)
  return topFavorites(resp.data ?? [])
}

export const FavoritesCard = () => {
  const t = useT()
  const { to } = useRouter()
  const [favs, { refetch }] = createResource(load)
  const message = () => {
    const e = favs.error
    return e ? (e instanceof Error ? e.message : String(e)) : undefined
  }
  return (
    <DashboardCard
      testid="dashboard-favorites"
      title={t("dashboard.favorites.title")}
      icon={TbBookmark}
      onOpen={() => to("/")}
    >
      <DataState
        loading={favs.loading}
        error={message()}
        onRetry={() => void refetch()}
        empty={!favs.loading && !favs.error && (favs() ?? []).length === 0}
        emptyText={t("dashboard.favorites.empty")}
      >
        <ul class="m-0 flex list-none flex-col gap-1 p-0">
          <For each={favs()}>
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
    </DashboardCard>
  )
}
