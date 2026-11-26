// The docked player (DESIGN_FE_VIEWER_PROTO_1127 §0 视频, §1.1). It opens at
// the top of the file area and the directory stays below as its playlist; it
// shrinks into a window pinned under the top bar when scrolled away.
//
// One <movi-player> is made for the page and never leaves the box it was put
// in (research 03 §六): opening, closing, shrinking, growing and switching
// files all leave the element where it is. A switch writes `src`, which keeps
// fullscreen (movi-player MoviElement.playlist docs); the mini window is the
// same box turned position:fixed, with a placeholder keeping its slot; the
// transforms of the animations are gone once they end.
import {
  For,
  Show,
  createEffect,
  createResource,
  createSignal,
  on,
  onCleanup,
  onMount,
  untrack,
} from "solid-js"
import {
  TbArrowBarToUp,
  TbDots,
  TbDownload,
  TbPlayerPauseFilled,
  TbPlayerPlayFilled,
  TbPlayerSkipBackFilled,
  TbPlayerSkipForwardFilled,
  TbX,
} from "solid-icons/tb"
import { Button } from "~/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { mediaClient } from "~/features/media/client"
import { cn } from "~/utils/cn"
import { asPreview } from "~/utils"
import { externalPlayers } from "~/utils/players"
import { copyText, download, externalHref, linkOf, statPath } from "./files"
import { boxOf, reducedMotion, run } from "./motion"
import {
  closeCurrent,
  dialogPath,
  dir,
  dockPath,
  entryAt,
  openEntry,
  overlayPath,
  setShareFor,
  sibling,
  takeRestore,
} from "./state"
import { IconButton, MENU_MOTION, isPhone } from "./ui"

type MoviEl = HTMLElement & {
  src: string | File | null
  playlist: unknown
  playlistIndex: number
  readonly paused: boolean
  play(): Promise<void>
  pause(): void
}

declare global {
  interface Window {
    /** The one player of the page, for the CI's identity check. */
    __player?: HTMLElement
    __moviCreated?: number
  }
}

const scrollToTop = () =>
  new Promise<void>((resolve) => {
    if (window.scrollY === 0) return resolve()
    if (reducedMotion()) {
      window.scrollTo(0, 0)
      return resolve()
    }
    window.addEventListener("scrollend", () => resolve(), { once: true })
    window.scrollTo({ top: 0, behavior: "smooth" })
  })

const barHeight = () =>
  parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue("--proto-bar"),
  ) || 64

export const Dock = () => {
  let host!: HTMLElement
  let slot!: HTMLDivElement
  let frame!: HTMLDivElement
  let videoBox!: HTMLDivElement
  let player: MoviEl | undefined
  const [ready, setReady] = createSignal(false)
  const [open, setOpen] = createSignal(false)
  const [mini, setMini] = createSignal(false)
  const [paused, setPaused] = createSignal(true)
  // an expand or collapse in progress; a newer one makes the older stop short
  let phase = 0
  let busy = false
  let loadSeq = 0

  const entry = () => entryAt(dockPath())
  const videos = () => dir()?.entries.filter((e) => e.kind === "video") ?? []
  const index = () => videos().findIndex((v) => v.path === dockPath())
  const prev = () => (dockPath() ? sibling(dockPath()!, -1) : undefined)
  const next = () => (dockPath() ? sibling(dockPath()!, 1) : undefined)

  // Episodes only for a media library's work (§0: 剧集栏只在媒体库条目里出现).
  const [episodes] = createResource(
    () => dir()?.path,
    async (p) => (await mediaClient.get(p))?.episodes ?? [],
  )
  const episodeBar = () => {
    const eps = episodes() ?? []
    const name = entry()?.name
    return eps.length > 0 && eps.some((e) => e.file_name === name) ? eps : []
  }

  onMount(async () => {
    await import("movi-player")
    const el = document.createElement("movi-player") as unknown as MoviEl
    for (const a of ["controls", "hdr", "fastseek", "autoplay"])
      el.setAttribute(a, "")
    el.setAttribute("theme", "dark")
    el.style.cssText = "display:block;width:100%;height:100%"
    // The list is the queue: movi shows previous/next on its bar and takes
    // Shift+N/P; we load each item ourselves (a src-less queue, see
    // MoviElement.playlist), so the URL and the list follow.
    el.addEventListener("itemchange", (e) => {
      e.preventDefault()
      const target = entryAt((e as CustomEvent).detail?.item?.id)
      if (target) openEntry(target, "replace")
    })
    el.addEventListener("play", () => setPaused(false))
    el.addEventListener("pause", () => setPaused(true))
    videoBox.append(el)
    player = el
    window.__player = el
    window.__moviCreated = (window.__moviCreated ?? 0) + 1
    setReady(true)
  })

  createEffect(() => {
    const list = videos()
    if (!ready() || !player) return
    player.playlist = list.map((v) => ({ id: v.path, title: v.name }))
    player.playlistIndex = untrack(index)
  })

  createEffect(
    on([dockPath, ready], async ([p, r]) => {
      if (!p || !r || !player) return
      const seq = ++loadSeq
      const obj = await statPath(p).catch(() => null)
      if (!obj || seq !== loadSeq || dockPath() !== p) return
      player.src = asPreview(obj.raw_url)
      player.playlistIndex = index()
    }),
  )

  const expand = async () => {
    const token = ++phase
    busy = true
    setOpen(true)
    await scrollToTop()
    if (token !== phase) return
    host.getAnimations().forEach((a) => a.cancel())
    host.style.height = "auto"
    const h = host.offsetHeight
    if (reducedMotion()) {
      await run(
        "dock-open",
        host,
        [{ opacity: 0 }, { opacity: 1 }],
        "dock-open",
        "standard",
      )
    } else {
      host.style.height = `${h}px`
      await run(
        "dock-open",
        host,
        [{ height: "0px" }, { height: `${h}px` }],
        "dock-open",
        "emphasized-decel",
      )
    }
    if (token !== phase) return
    host.style.height = "auto"
    busy = false
  }

  const setPlayerControls = (on: boolean) => {
    if (on) player?.setAttribute("controls", "")
    else player?.removeAttribute("controls")
  }

  const collapse = async () => {
    const token = ++phase
    busy = true
    const y = takeRestore()
    if (mini()) {
      setMini(false)
      setPlayerControls(true)
    }
    host.getAnimations().forEach((a) => a.cancel())
    const h = host.offsetHeight
    // back to where the list was: the dock folds above it, out of sight
    if (y !== undefined && y > 0) window.scrollTo(0, y + h)
    if (reducedMotion()) {
      await run(
        "dock-close",
        host,
        [{ opacity: 1 }, { opacity: 0 }],
        "dock-close",
        "standard",
      )
      host.style.height = "0px"
    } else {
      host.style.height = "0px"
      await run(
        "dock-close",
        host,
        [{ height: `${h}px` }, { height: "0px" }],
        "dock-close",
        "emphasized-accel",
      )
    }
    if (token !== phase) return
    setOpen(false)
    player?.pause()
    if (y !== undefined) window.scrollTo(0, y)
    busy = false
  }

  createEffect(
    on(
      () => dockPath() !== null,
      (isOpen, wasOpen) => {
        if (isOpen && !wasOpen) void expand()
        else if (!isOpen && wasOpen) void collapse()
      },
    ),
  )

  // Shrink when the slot is scrolled mostly under the top bar, grow back when
  // it comes back. FLIP from the old box to the new one (02 §三 is silent on
  // this; standard curve, 250ms, the MD3 medium band).
  const toMini = (want: boolean) => {
    const before = boxOf(videoBox)
    setMini(want)
    if (isPhone()) setPlayerControls(!want)
    const after = boxOf(videoBox)
    if (reducedMotion()) {
      void run(
        "dock-mini",
        frame,
        [{ opacity: 0 }, { opacity: 1 }],
        "dock-mini",
        "standard",
      )
      return
    }
    void run(
      want ? "dock-to-mini" : "dock-from-mini",
      frame,
      [
        {
          transformOrigin: "0 0",
          transform: `translate(${before.left - after.left}px, ${before.top - after.top}px) scale(${before.width / after.width}, ${before.height / after.height})`,
        },
        { transformOrigin: "0 0", transform: "none" },
      ],
      "dock-mini",
      "standard",
    )
  }

  createEffect(() => {
    isPhone() // the bar height differs per tier
    const bar = barHeight()
    const io = new IntersectionObserver(
      ([en]) => {
        if (!open() || busy || !en) return
        const want =
          en.intersectionRatio < 0.5 && en.boundingClientRect.top < bar
        if (want !== mini()) toMini(want)
      },
      {
        rootMargin: `-${bar}px 0px 0px 0px`,
        threshold: [0, 0.25, 0.5, 0.75, 1],
      },
    )
    io.observe(slot)
    onCleanup(() => io.disconnect())
  })

  const onKey = (e: KeyboardEvent) => {
    if (!dockPath() || overlayPath() || dialogPath() || !e.shiftKey) return
    const t = e.target as HTMLElement | null
    if (t?.closest("input, textarea, [contenteditable]")) return
    // movi takes the same keys itself while it has the focus
    if (player && e.composedPath().includes(player)) return
    const k = e.key.toLowerCase()
    const to = k === "n" ? next() : k === "p" ? prev() : undefined
    if (to) {
      e.preventDefault()
      openEntry(to, "replace")
    }
  }
  document.addEventListener("keydown", onKey)
  onCleanup(() => document.removeEventListener("keydown", onKey))

  const togglePlay = () => {
    if (!player) return
    if (player.paused) void player.play()
    else player.pause()
  }

  return (
    <section
      ref={host}
      aria-label="视频播放器"
      data-testid="dock"
      data-open={open() ? "true" : "false"}
      data-mini={mini() ? "true" : "false"}
      inert={!open()}
      class="overflow-clip border-b"
      style={{ height: "0px" }}
    >
      <div class="bg-black">
        <div
          ref={slot}
          class="relative mx-auto aspect-video w-[min(100%,calc(min(70vh,760px)*16/9))]"
        >
          <div
            ref={frame}
            data-testid="dock-frame"
            class={cn(
              !mini() && "absolute inset-0",
              mini() &&
                !isPhone() &&
                "fixed right-4 top-[calc(var(--proto-bar)+12px)] z-40 flex w-[min(400px,42vw)] flex-col overflow-hidden rounded-lg bg-black shadow-2xl ring-1 ring-white/10",
              mini() &&
                isPhone() &&
                "fixed inset-x-0 top-(--proto-bar) z-40 flex h-[72px] flex-row bg-background shadow-md border-b",
            )}
          >
            <div
              ref={videoBox}
              class={cn(
                "bg-black",
                !mini() && "h-full w-full",
                mini() && !isPhone() && "aspect-video w-full",
                mini() && isPhone() && "aspect-video h-full shrink-0",
              )}
            />
            <Show when={mini()}>
              <div
                data-testid="mini-bar"
                class={cn(
                  "flex min-w-0 flex-1 items-center gap-1 px-2",
                  !isPhone() && "h-11 bg-neutral-900 text-white",
                )}
              >
                <span class="min-w-0 flex-1 truncate text-sm">
                  {entry()?.name}
                </span>
                <Show when={isPhone()}>
                  <IconButton
                    label={paused() ? "播放" : "暂停"}
                    onClick={togglePlay}
                  >
                    {paused() ? (
                      <TbPlayerPlayFilled />
                    ) : (
                      <TbPlayerPauseFilled />
                    )}
                  </IconButton>
                </Show>
                <IconButton
                  label="回到播放器"
                  onDark={!isPhone()}
                  onClick={() => void scrollToTop()}
                >
                  <TbArrowBarToUp />
                </IconButton>
                <IconButton
                  label="关闭播放器"
                  testid="mini-close"
                  onDark={!isPhone()}
                  onClick={() => closeCurrent(true)}
                >
                  <TbX />
                </IconButton>
              </div>
            </Show>
          </div>
        </div>
      </div>

      <div class="flex items-center gap-1 px-3 py-2 sm:px-4">
        <div class="min-w-0 flex-1">
          <div class="truncate text-sm font-medium" data-testid="dock-title">
            {entry()?.name}
          </div>
          <div class="text-xs text-muted-foreground">
            视频 {index() + 1} / {videos().length}
          </div>
        </div>
        <IconButton
          label="上一个 (Shift+P)"
          testid="dock-prev"
          disabled={!prev()}
          onClick={() => prev() && openEntry(prev()!, "replace")}
        >
          <TbPlayerSkipBackFilled />
        </IconButton>
        <IconButton
          label="下一个 (Shift+N)"
          testid="dock-next"
          disabled={!next()}
          onClick={() => next() && openEntry(next()!, "replace")}
        >
          <TbPlayerSkipForwardFilled />
        </IconButton>
        <IconButton
          label="下载"
          testid="dock-download"
          onClick={() => entry() && download(entry()!)}
        >
          <TbDownload />
        </IconButton>
        <DropdownMenu>
          <DropdownMenuTrigger
            as={Button}
            variant="ghost"
            size="icon"
            aria-label="更多"
            class="shrink-0 [&_svg]:size-5"
          >
            <TbDots />
          </DropdownMenuTrigger>
          <DropdownMenuContent class={MENU_MOTION}>
            <DropdownMenuItem
              onSelect={() => entry() && void copyText(linkOf(entry()!))}
            >
              复制链接
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>用外部播放器打开</DropdownMenuSubTrigger>
              <DropdownMenuSubContent class={MENU_MOTION}>
                <For each={externalPlayers.filter((p) => !p.requiresItem)}>
                  {(p) => (
                    <DropdownMenuItem
                      as="a"
                      href={
                        entry()
                          ? externalHref(
                              p.scheme,
                              linkOf(entry()!),
                              entry()!.name,
                            )
                          : undefined
                      }
                    >
                      {p.name}
                    </DropdownMenuItem>
                  )}
                </For>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => entry() && setShareFor([entry()!])}
            >
              分享
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <IconButton
          label="关闭播放器"
          testid="dock-close"
          onClick={() => closeCurrent()}
        >
          <TbX />
        </IconButton>
      </div>

      <Show when={episodeBar().length > 0}>
        <nav
          aria-label="剧集"
          data-testid="episode-bar"
          class="flex gap-2 overflow-x-auto px-3 pb-3 sm:px-4"
        >
          <For each={episodeBar()}>
            {(ep) => {
              const target = () =>
                entryAt(
                  `${dir()!.path === "/" ? "" : dir()!.path}/${ep.file_name}`,
                )
              const current = () => entry()?.name === ep.file_name
              return (
                <button
                  type="button"
                  aria-current={current() ? "true" : undefined}
                  class={cn(
                    "flex shrink-0 flex-col items-start rounded-md border px-3 py-1.5 text-left text-sm transition-colors hover:bg-accent",
                    current() && "border-primary bg-primary/10 text-primary",
                  )}
                  onClick={() => target() && openEntry(target()!, "replace")}
                >
                  <span class="font-medium">第 {ep.episode} 集</span>
                  <Show when={ep.title}>
                    <span class="max-w-40 truncate text-xs text-muted-foreground">
                      {ep.title}
                    </span>
                  </Show>
                </button>
              )
            }}
          </For>
        </nav>
      </Show>
    </section>
  )
}
