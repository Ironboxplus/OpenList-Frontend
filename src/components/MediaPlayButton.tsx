import { For, Show, createSignal } from "solid-js"
import { Dynamic } from "solid-js/web"
import {
  TbBrandVlc,
  TbBrowser,
  TbCheck,
  TbChevronDown,
  TbDeviceTv,
  TbPlayerPlay,
} from "solid-icons/tb"
import { api, getPlatform, notify } from "~/utils"
import { getMediaStreamUrl } from "~/utils/media_api"
import { Button } from "~/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { useT } from "~/hooks"
import { playersForPlatform, renderPlayerScheme } from "~/utils/players"

const TARGET_KEY = "media-play-target"

interface MediaPlayButtonProps {
  itemId?: number
  path?: string
  episode?: number
  name?: string
  /** 选择「浏览器」时执行：通常是打开站内播放器 */
  onBrowserPlay: () => void
}

const iconOf = (id: string) => {
  switch (id) {
    case "browser":
      return TbBrowser
    case "vlc":
      return TbBrandVlc
    case "emby":
      return TbDeviceTv
    default:
      return TbPlayerPlay
  }
}

/**
 * 播放主按钮 + 播放器下拉二合一。
 * 默认「浏览器播放」；切换为外部播放器后，文本固定为「播放器播放」。
 */
export const MediaPlayButton = (props: MediaPlayButtonProps) => {
  const t = useT()
  const players = () => playersForPlatform(getPlatform())

  const stored = (() => {
    try {
      return localStorage.getItem(TARGET_KEY) ?? "browser"
    } catch {
      return "browser"
    }
  })()

  const isAvailable = (id: string) =>
    id === "browser" || players().some((p) => p.id === id)

  const [target, setTarget] = createSignal(
    isAvailable(stored) ? stored : "browser",
  )
  const [directURL, setDirectURL] = createSignal<string | null>(null)
  const [embyServerId, setEmbyServerId] = createSignal<string | null>(null)
  let prefetching: Promise<unknown> | null = null

  const current = () => players().find((p) => p.id === target())
  const label = () =>
    target() === "browser" ? t("media.play.browser") : t("media.play.external")

  const resolveURL = async (): Promise<string | null> => {
    if (props.path) {
      const resp = await getMediaStreamUrl({ path: props.path })
      if (resp.code !== 200 || !resp.data) {
        notify.error(resp.message || t("media.play.link_failed"))
        return null
      }
      return resp.data.url
    }
    if (!props.itemId) {
      notify.error(t("media.play.missing_info"))
      return null
    }
    const resp = await getMediaStreamUrl({
      id: props.itemId,
      episode: props.episode,
    })
    if (resp.code !== 200 || !resp.data) {
      notify.error(resp.message || t("media.play.link_failed"))
      return null
    }
    return resp.data.url
  }

  const resolveEmbyServer = async (): Promise<string | null> => {
    if (embyServerId()) return embyServerId()
    try {
      const resp = await fetch(`${api}/@emby/System/Info/Public`)
      const data = await resp.json()
      if (data?.Id) {
        setEmbyServerId(String(data.Id))
        return String(data.Id)
      }
    } catch {
      /* ignore */
    }
    return null
  }

  const prefetch = () => {
    if (target() === "browser" || prefetching) return
    prefetching =
      target() === "emby"
        ? resolveEmbyServer().finally(() => {
            prefetching = null
          })
        : resolveURL()
            .then((url) => {
              if (url) setDirectURL(url)
              return url
            })
            .finally(() => {
              prefetching = null
            })
  }

  const launch = (
    scheme: string,
    url: string,
    serverId?: string,
    itemId?: number,
  ) => {
    window.location.href = renderPlayerScheme(scheme, {
      durl: url,
      name: props.name ?? "media",
      serverId,
      itemId,
    })
  }

  const play = async () => {
    if (target() === "browser") {
      props.onBrowserPlay()
      return
    }
    const player = current()
    if (!player) {
      props.onBrowserPlay()
      return
    }

    // Emby 走自身深链（服务器 ID + 条目 ID），不播放直链
    if (player.id === "emby") {
      if (!props.itemId) {
        notify.error(t("media.play.missing_info"))
        return
      }
      const serverId = embyServerId()
      if (serverId) {
        launch(player.scheme, "", serverId, props.itemId)
        return
      }
      const sid = await resolveEmbyServer()
      if (!sid) {
        notify.error(t("media.play.emby_failed"))
        return
      }
      launch(player.scheme, "", sid, props.itemId)
      return
    }

    const cached = directURL()
    if (cached) {
      launch(player.scheme, cached)
      return
    }
    const url = await resolveURL()
    if (!url) return
    setDirectURL(url)
    launch(player.scheme, url)
  }

  const select = (id: string) => {
    setTarget(id)
    setDirectURL(null)
    try {
      localStorage.setItem(TARGET_KEY, id)
    } catch {
      /* ignore */
    }
  }

  return (
    <div class="inline-flex">
      <Button
        class="gap-2 rounded-r-none"
        onClick={play}
        onMouseEnter={prefetch}
        onFocus={prefetch}
      >
        <Dynamic component={iconOf(target())} class="size-4" />
        {label()}
      </Button>
      <DropdownMenu placement="bottom-start">
        <DropdownMenuTrigger
          as={Button}
          class="w-8 rounded-l-none border-l border-primary-foreground/25 px-0"
          aria-label={t("media.play.choose")}
          title={t("media.play.choose")}
        >
          <TbChevronDown class="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent class="max-h-[340px] min-w-[200px] overflow-y-auto">
          <For
            each={[
              { id: "browser", name: t("media.play.browser") },
              ...players().map((p) => ({ id: p.id, name: p.name })),
            ]}
          >
            {(item) => (
              <DropdownMenuItem class="gap-2" onSelect={() => select(item.id)}>
                <Dynamic component={iconOf(item.id)} class="size-4" />
                <span class="flex-1">{item.name}</span>
                <Show when={target() === item.id}>
                  <TbCheck class="size-4" />
                </Show>
              </DropdownMenuItem>
            )}
          </For>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
