// The media area inside the app shell: a secondary nav (the shell's own
// sidebar is the primary one), the page of the chosen library and the music
// player that stays above all of them. Mounted by the `/@media` layout route.
import { useColorMode } from "@hope-ui/solid"
import { Navigate, Outlet } from "@solidjs/router"
import {
  Component,
  createEffect,
  createMemo,
  For,
  lazy,
  onCleanup,
  Show,
  Suspense,
} from "solid-js"
import { Dynamic } from "solid-js/web"
import { TbBook, TbMovie, TbMusic, TbPhoto, TbSettings } from "solid-icons/tb"
import { focusRing } from "~/components/ui/focus"
import { NavLink } from "~/features/shell/NavLink"
import { useRouter, useT } from "~/hooks"
import { getSettingBool, me } from "~/store"
import {
  accent,
  applyAccentPalette,
  clearAccentPalette,
  mediaAccentEnabled,
} from "~/store/accent"
import { mediaStatus } from "~/store/media"
import { MediaType, UserMethods } from "~/types"
import { cn } from "~/utils/cn"
import { joinBase } from "~/utils/path"
import { MediaAccentPicker } from "./MediaAccentPicker"

// The player is only needed inside the library: lazy, so it stays out of the
// entry chunk and costs nothing while the media library is off.
const MusicPlayer = lazy(() =>
  import("./music/player").then((m) => ({ default: m.MusicPlayer })),
)

interface NavEntry {
  id: string
  label: string
  path: string
  icon: Component<{ class?: string }>
}

const TYPE_ENTRIES: Record<MediaType, Omit<NavEntry, "id">> = {
  video: {
    label: "home.media.nav_video",
    path: "/@media/video",
    icon: TbMovie,
  },
  music: {
    label: "home.media.nav_music",
    path: "/@media/music",
    icon: TbMusic,
  },
  image: {
    label: "home.media.nav_image",
    path: "/@media/image",
    icon: TbPhoto,
  },
  book: { label: "home.media.nav_book", path: "/@media/books", icon: TbBook },
}

/** The libraries the server has switched on, in display order. */
const enabledTypes = (types: MediaType[]): MediaType[] =>
  (Object.keys(TYPE_ENTRIES) as MediaType[]).filter((t) => types.includes(t))

/** `/@media` itself has no page: it opens the first library that is on, or leaves when none is. */
export const MediaIndex = () => {
  const first = () => enabledTypes(mediaStatus().types)[0]
  return (
    <Navigate href={joinBase(first() ? TYPE_ENTRIES[first()!].path : "/")} />
  )
}

const MediaNav = () => {
  const t = useT()
  const { pathname } = useRouter()
  const entries = createMemo<NavEntry[]>(() => {
    const list: NavEntry[] = enabledTypes(mediaStatus().types).map((type) => ({
      id: type,
      ...TYPE_ENTRIES[type],
    }))
    if (UserMethods.is_admin(me())) {
      list.push({
        id: "settings",
        label: "home.media.nav_settings",
        path: "/@manage/media/settings",
        icon: TbSettings,
      })
    }
    return list
  })
  return (
    <nav
      aria-label={t("home.media.title")}
      data-media-nav
      class="flex items-center gap-2 overflow-x-auto px-4 pt-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <For each={entries()}>
        {(entry) => {
          const active = () =>
            pathname() === entry.path || pathname().startsWith(entry.path + "/")
          return (
            <NavLink
              path={entry.path}
              aria-current={active() ? "page" : undefined}
              data-media-nav-item={entry.id}
              class={cn(
                focusRing,
                "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-sm no-underline transition-colors hover:no-underline",
                active()
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-card text-foreground hover:bg-accent",
              )}
            >
              <Dynamic component={entry.icon} class="size-4 shrink-0" />
              {t(entry.label)}
            </NavLink>
          )
        }}
      </For>
      <div class="flex-1" />
      <MediaAccentPicker />
    </nav>
  )
}

/**
 * The media theme colour applies on media pages only: files, settings and
 * login keep the site palette. Light and dark each have their own scale, so it
 * is written again when the colour mode changes.
 */
const useMediaAccent = () => {
  const { colorMode } = useColorMode()
  createEffect(() => {
    if (mediaAccentEnabled()) {
      applyAccentPalette(accent(), colorMode() === "dark")
    } else {
      clearAccentPalette()
    }
  })
  onCleanup(clearAccentPalette)
}

const MediaSection = () => {
  useMediaAccent()
  return (
    <Show
      when={getSettingBool("media_enabled")}
      fallback={<Navigate href={joinBase("/")} />}
    >
      <Suspense fallback={null}>
        <MusicPlayer />
      </Suspense>
      <div
        class="flex w-full flex-col"
        style={{
          "min-height":
            "calc(100dvh - var(--shell-top, 0px) - var(--shell-gap, 0px) - 2px)",
        }}
      >
        <MediaNav />
        <main class="flex min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </Show>
  )
}

export default MediaSection
