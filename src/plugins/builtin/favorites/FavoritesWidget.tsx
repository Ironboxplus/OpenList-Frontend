import {
  Box,
  HStack,
  Icon,
  IconButton,
  Popover,
  PopoverArrow,
  PopoverBody,
  PopoverContent,
  PopoverHeader,
  PopoverTrigger,
  Spinner,
  Text,
  VStack,
} from "@hope-ui/solid"
import { For, Show, createSignal } from "solid-js"
import { TbBookmark, TbBookmarkFilled, TbFolder, TbFile } from "solid-icons/tb"
import { useRouter, useT } from "~/hooks"
import { objStore } from "~/store"
import { handleResp, notify, r } from "~/utils"
import type { PResp } from "~/types"
import type { Plugin } from "../../registry"
import { isFavorited, sortFavorites, type Favorite } from "./data"

export const FavoritesWidget = () => {
  const t = useT()
  const { to, pathname } = useRouter()
  const [favorites, setFavorites] = createSignal<Favorite[]>([])
  const [loading, setLoading] = createSignal(false)

  const refresh = async () => {
    setLoading(true)
    try {
      const resp: PResp<Favorite[]> = r.get("/me/favorites")
      handleResp(await resp, (data) => setFavorites(sortFavorites(data ?? [])))
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
      is_dir: objStore.obj?.is_dir ?? true,
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
        as={IconButton}
        aria-label={t("home.favorites.title")}
        compact
        size="lg"
        variant="ghost"
        icon={<TbBookmark />}
      />
      <PopoverContent w="$96" maxW="90vw">
        <PopoverArrow />
        <PopoverHeader border="none">
          <HStack justifyContent="space-between" w="$full">
            <Text fontWeight="$medium">{t("home.favorites.title")}</Text>
            <IconButton
              aria-label={t("home.favorites.add")}
              size="sm"
              variant="ghost"
              disabled={currentIsFavorited()}
              icon={
                currentIsFavorited() ? <TbBookmarkFilled /> : <TbBookmark />
              }
              onClick={addCurrent}
            />
          </HStack>
        </PopoverHeader>
        <PopoverBody maxH="$96" overflowY="auto">
          <Show
            when={!loading()}
            fallback={
              <HStack justifyContent="center" py="$4">
                <Spinner size="sm" />
              </HStack>
            }
          >
            <Show
              when={favorites().length > 0}
              fallback={
                <Text color="$neutral10" textAlign="center" py="$4">
                  {t("home.favorites.empty")}
                </Text>
              }
            >
              <VStack alignItems="stretch" spacing="$1">
                <For each={favorites()}>
                  {(fav) => (
                    <HStack
                      px="$2"
                      py="$2"
                      rounded="$md"
                      cursor="pointer"
                      _hover={{ bgColor: "$neutral4" }}
                      justifyContent="space-between"
                      onClick={() => to(fav.path)}
                    >
                      <HStack spacing="$2" minW="0">
                        <Icon
                          as={fav.is_dir ? TbFolder : TbFile}
                          color="$neutral10"
                          boxSize="$5"
                        />
                        <Box minW="0">
                          <Text noOfLines={1}>{fav.name || fav.path}</Text>
                          <Show when={fav.tag}>
                            <Text
                              fontSize="$xs"
                              color="$neutral10"
                              noOfLines={1}
                            >
                              {fav.tag}
                            </Text>
                          </Show>
                        </Box>
                      </HStack>
                      <IconButton
                        aria-label={t("home.favorites.remove")}
                        size="xs"
                        variant="ghost"
                        colorScheme="danger"
                        icon={<TbBookmarkFilled />}
                        onClick={(e: MouseEvent) => remove(fav, e)}
                      />
                    </HStack>
                  )}
                </For>
              </VStack>
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
