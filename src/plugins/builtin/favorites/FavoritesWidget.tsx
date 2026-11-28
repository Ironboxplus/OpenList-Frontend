import { For, Show, createSignal } from "solid-js"
import { Dynamic } from "solid-js/web"
import { TbBookmark, TbBookmarkFilled, TbFolder, TbFile } from "solid-icons/tb"
import { useRouter, useT } from "~/hooks"
import { handleResp, notify, r } from "~/utils"
import type { PResp } from "~/types"
import type { Plugin } from "../../registry"
import { fetchFavorites } from "./api"
import { isFavorited, sortFavorites, type Favorite } from "./data"
import {
  Popover,
  PopoverArrow,
  PopoverBody,
  PopoverContent,
  PopoverHeader,
  PopoverTrigger,
} from "~/components/overlay"
import { Button } from "~/components/ui/button"
import { Spinner } from "~/components/ui/spinner"

export const FavoritesWidget = () => {
  const t = useT()
  const { to, pathname } = useRouter()
  const [favorites, setFavorites] = createSignal<Favorite[]>([])
  const [loading, setLoading] = createSignal(false)

  const refresh = async () => {
    setLoading(true)
    try {
      handleResp(await fetchFavorites(), (data) =>
        setFavorites(sortFavorites(data ?? [])),
      )
    } finally {
      setLoading(false)
    }
  }

  const currentPath = () => pathname() || "/"
  const currentIsFavorited = () => isFavorited(favorites(), currentPath())

  const addCurrent = async () => {
    const path = currentPath()
    const name =
      path === "/" ? "/" : path.split("/").filter(Boolean).pop() || "/"
    const resp: PResp<Favorite> = r.post("/me/favorites/add", {
      path,
      name,
      // the page is always a folder, also with a file open over it
      is_dir: true,
      tag: "",
    })
    handleResp(await resp, () => {
      notify.success(t("home.favorites.added"))
      refresh()
    })
  }

  const remove = async (fav: Favorite, e: MouseEvent) => {
    e.stopPropagation()
    const resp: PResp<{}> = r.post(`/me/favorites/delete?id=${fav.id}`)
    handleResp(await resp, () => {
      notify.success(t("home.favorites.removed"))
      refresh()
    })
  }

  return (
    <Popover placement="bottom-end" onOpen={refresh} closeOnBlur>
      <PopoverTrigger
        as={Button}
        aria-label={t("home.favorites.title")}
        size="icon-lg"
        variant="ghost"
      >
        <TbBookmark />
      </PopoverTrigger>
      <PopoverContent w="$96" maxW="90vw">
        <PopoverArrow />
        <PopoverHeader border="none">
          <div class="flex flex-row items-center justify-between w-full">
            <p class="font-medium">{t("home.favorites.title")}</p>
            <Button
              aria-label={t("home.favorites.add")}
              size="icon-sm"
              variant="ghost"
              disabled={currentIsFavorited()}
              onClick={addCurrent}
            >
              {currentIsFavorited() ? <TbBookmarkFilled /> : <TbBookmark />}
            </Button>
          </div>
        </PopoverHeader>
        <PopoverBody maxH="$96" overflowY="auto">
          <Show
            when={!loading()}
            fallback={
              <div class="flex flex-row items-center justify-center py-4">
                <Spinner size="sm" />
              </div>
            }
          >
            <Show
              when={favorites().length > 0}
              fallback={
                <p class="text-muted-foreground text-center py-4">
                  {t("home.favorites.empty")}
                </p>
              }
            >
              <div class="flex flex-col items-stretch gap-y-1">
                <For each={favorites()}>
                  {(fav) => (
                    <div
                      class="flex flex-row items-center px-2 py-2 rounded-md cursor-pointer justify-between hover:bg-accent"
                      onClick={() => to(fav.path)}
                    >
                      <div class="flex flex-row items-center min-w-0 gap-x-2">
                        <Dynamic
                          component={fav.is_dir ? TbFolder : TbFile}
                          class="size-5 text-muted-foreground"
                        />
                        <div class="min-w-0">
                          <p class="line-clamp-1">{fav.name || fav.path}</p>
                          <Show when={fav.tag}>
                            <p class="text-xs text-muted-foreground line-clamp-1">
                              {fav.tag}
                            </p>
                          </Show>
                        </div>
                      </div>
                      <Button
                        aria-label={t("home.favorites.remove")}
                        size="icon-xs"
                        variant="ghost"
                        class="text-destructive hover:text-destructive"
                        onClick={(e: MouseEvent) => remove(fav, e)}
                      >
                        <TbBookmarkFilled />
                      </Button>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </Show>
        </PopoverBody>
      </PopoverContent>
    </Popover>
  )
}

export const favoritesPlugin: Plugin = {
  id: "builtin.favorites",
  name: "Favorites",
  contributions: [
    { slot: "header-right", component: FavoritesWidget, order: -5 },
  ],
}
