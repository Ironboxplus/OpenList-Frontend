// The docked player (plan §0.2 视频; the prototype's Dock.tsx, run
// 45866187867). It opens at the top of the file card and the folder stays below
// as its playlist; scrolled away it shrinks into a window under the top bar
// (a corner window on a desktop, which can be dragged; a 72px bar on a phone).
// A video clicked deep in the list opens in that window at once, and the list
// stays where it was.
//
// One <movi-player> is made for the page and never leaves the box it was put
// in: opening, closing, shrinking, growing and switching files all leave the
// element where it is (MoviCore), so fullscreen survives a switch. The mini
// window is the same box turned position:fixed while its slot keeps the room.
import {
  TbArrowBarToUp,
  TbDownload,
  TbPlayerPauseFilled,
  TbPlayerPlayFilled,
  TbPlayerSkipBackFilled,
  TbPlayerSkipForwardFilled,
  TbX,
} from "solid-icons/tb"
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  on,
  onCleanup,
  Show,
  untrack,
} from "solid-js"
import { useDownload, useRouter, useT } from "~/hooks"
import { downloadDenied, objStore, password, singleFileShare } from "~/store"
import { ObjType, type Obj } from "~/types"
import { fsGet, notify, pathJoin } from "~/utils"
import { cn } from "~/utils/cn"
import { MotionTokens } from "~/platform/motion"
import { mediaFs, mediaPath } from "~/features/media/state"
import { MoviCore } from "~/pages/home/previews/movi_core"
import { autoNext } from "./auto-next"
import { boxOf, isPhone, run, shellTop } from "./motion"
import {
  closeCurrent,
  dialogPath,
  dockPath,
  entryOf,
  folderOf,
  openPath,
  overlay,
  sibling,
  step,
  takeRestore,
} from "./state"
import { ToolButton, ViewerMore } from "./ViewerMore"

type MoviEl = HTMLElement & {
  playlist: unknown
  playlistIndex: number
  readonly paused: boolean
  play(): Promise<void>
  pause(): void
}

const isVideo = (o: Obj) => o.type === ObjType.VIDEO
const nameOf = (path: string) => path.split("/").pop()!
/** The title row under the video (two text lines and its padding), px. */
const TITLE_ROW = 52
/**
 * What lies above the video in the window, px: the video's top is 21px under
 * the top bar's bottom (--shell-top) at scroll 0 (CI 46127847627), and a margin.
 */
const EDGES = 32

/**
 * Puts the window's scroll at `top` at once. The dock's own height and the
 * mini window's FLIP are the motion; a smooth scroll before them would only
 * delay them (and a scroll that cannot move never says it ended).
 */
const scrollToTop = (top: number) => window.scrollTo(0, Math.max(0, top))

/**
 * The page keeps its place by itself when content above the screen changes
 * height (scroll anchoring); the dock moves the list on purpose and says where
 * it goes, so anchoring is off while it does.
 */
const anchoring = (on: boolean) => {
  document.documentElement.style.overflowAnchor = on ? "" : "none"
}

export const Dock = () => {
  const t = useT()
  const { isShare } = useRouter()
  const { downloadObjs } = useDownload()
  let host!: HTMLElement
  let slot!: HTMLDivElement
  let frame!: HTMLDivElement
  let player: MoviEl | undefined
  const [ready, setReady] = createSignal(false)
  const [open, setOpen] = createSignal(false)
  const [mini, setMini] = createSignal(false)
  const [paused, setPaused] = createSignal(true)
  /**
   * The player waits for the dock to open before it loads: movi's start-up
   * holds the main thread, which would make the opening stutter (plan §0.3-3).
   */
  const [holding, setHolding] = createSignal(false)
  /** Where the corner window was dragged to, from its place. */
  const [drag, setDrag] = createSignal<[number, number]>([0, 0])
  /** The video the element plays: its fs/get answer. */
  const [src, setSrc] = createSignal<{
    path: string
    url: string
    provider: string
  }>()
  // an expand or collapse in progress; a newer one makes the older stop short
  let phase = 0
  let busy = false
  let loadSeq = 0

  const entry = createMemo(() => entryOf(dockPath()))
  const videos = () => objStore.objs.filter((o) => !o.is_dir && isVideo(o))
  const index = () => {
    const p = dockPath()
    return p ? videos().findIndex((v) => v.name === nameOf(p)) : -1
  }
  const idOf = (name: string) =>
    singleFileShare() ? dockPath()! : pathJoin(objStore.listed || "/", name)
  const prev = () =>
    dockPath() ? sibling(dockPath()!, -1, isVideo) : undefined
  const next = () => (dockPath() ? sibling(dockPath()!, 1, isVideo) : undefined)
  const go = (by: 1 | -1) => !!dockPath() && step(dockPath()!, by, isVideo)

  // Episodes only in a media library's work: what the media view read for
  // this folder (MediaController), no request of its own.
  const episodes = createMemo(() => {
    const p = dockPath()
    if (!p || mediaPath() !== folderOf(p)) return []
    const eps = mediaFs()?.episodes ?? []
    const name = nameOf(p)
    return eps.some((e) => e.file_name === name) ? eps : []
  })

  // fs/get of each video: its stream and storage, set together so the element
  // loads once per video
  createEffect(
    on(dockPath, async (p) => {
      if (!p) return
      const seq = ++loadSeq
      const resp = await fsGet(p, isShare() ? "" : password())
      if (seq !== loadSeq || dockPath() !== p) return
      if (resp.code === 200)
        setSrc({
          path: p,
          url: resp.data.raw_url,
          provider: resp.data.provider,
        })
      else notify.error(resp.message)
    }),
  )

  const onPlayer = (el: HTMLElement) => {
    const m = el as MoviEl
    // The list is the queue: movi shows previous/next on its bar and takes
    // Shift+N/P while it has the focus (also in fullscreen); we load each item
    // ourselves (a src-less queue, movi-player README "Queues the host
    // loads"), so the address and the list follow.
    m.addEventListener("itemchange", (e) => {
      const id = (e as CustomEvent).detail?.item?.id as string | undefined
      e.preventDefault()
      if (id && id !== dockPath()) openPath(id, { replace: true })
    })
    m.addEventListener("play", () => setPaused(false))
    m.addEventListener("pause", () => setPaused(true))
    player = m
    setReady(true)
  }

  createEffect(() => {
    const list = videos()
    if (!ready() || !player) return
    player.playlist = list.map((v) => ({ id: idOf(v.name), title: v.name }))
    const i = untrack(index)
    if (i >= 0) player.playlistIndex = i
  })
  createEffect(
    on([src, ready], ([s, r]) => {
      if (!s || !r || !player) return
      const i = index()
      if (i >= 0 && player.playlistIndex !== i) player.playlistIndex = i
    }),
  )

  const setPlayerControls = (on: boolean) => {
    if (on) player?.setAttribute("controls", "")
    else player?.removeAttribute("controls")
  }

  /** Mini window on or off, with a FLIP from the old box to the new one. */
  const toMini = (want: boolean) => {
    const before = boxOf(frame)
    if (!want) setDrag([0, 0])
    setMini(want)
    if (isPhone()) setPlayerControls(!want)
    const after = boxOf(frame)
    if (!after.width || !after.height) return
    frame.style.transformOrigin = "0 0"
    void run(
      frame,
      {
        transform: [
          `translate(${before.left - after.left}px, ${before.top - after.top}px) scale(${before.width / after.width}, ${before.height / after.height})`,
          "translate(0px, 0px) scale(1, 1)",
        ],
      },
      MotionTokens.options.dockMini,
      [0, 1],
    ).then(() => {
      frame.style.transform = ""
      frame.style.opacity = ""
    })
  }

  const expand = async () => {
    const token = ++phase
    busy = true
    anchoring(false)
    setOpen(true)
    host.style.height = "auto"
    const h = host.offsetHeight
    const top = host.getBoundingClientRect().top
    const bar = shellTop()
    if (top + h / 2 < bar) {
      // deep in the list: the player opens as the mini window, and the list
      // keeps its place under the room the dock takes above it
      window.scrollBy(0, h)
      setMini(true)
      if (isPhone()) setPlayerControls(false)
      await run(frame, { opacity: [0, 1] }, MotionTokens.options.dockMini)
      if (token !== phase) return
      frame.style.opacity = ""
      anchoring(true)
      busy = false
      checkMini()
      return
    }
    host.style.height = "0px"
    // the dock right under the top bar, the list below it
    scrollToTop(window.scrollY + top - bar - 8)
    setHolding(true)
    await run(
      host,
      { height: ["0px", `${h}px`] },
      MotionTokens.options.dockEnter,
      [0, 1],
    )
    setHolding(false)
    if (token !== phase) return
    host.style.height = "auto"
    host.style.opacity = ""
    anchoring(true)
    busy = false
    // a scroll while it opened went unanswered
    checkMini()
  }

  const collapse = async () => {
    const token = ++phase
    busy = true
    anchoring(false)
    // a playing video keeps the main thread busy: stop it before the fold
    player?.pause()
    const y = takeRestore()
    if (mini()) {
      setMini(false)
      setDrag([0, 0])
      setPlayerControls(true)
    }
    const h = host.offsetHeight
    // back to where the list was: the dock folds above it, out of sight
    if (y !== undefined && y > 0) window.scrollTo(0, y + h)
    await run(
      host,
      { height: [`${h}px`, "0px"] },
      MotionTokens.options.dockExit,
      [1, 0],
    )
    if (token !== phase) return
    host.style.height = "0px"
    host.style.opacity = ""
    setOpen(false)
    if (y !== undefined) window.scrollTo(0, y)
    anchoring(true)
    busy = false
  }

  createEffect(
    on(
      () => dockPath() !== undefined,
      (isOpen, wasOpen) => {
        if (isOpen && !wasOpen) void expand()
        else if (!isOpen && wasOpen) void collapse()
      },
    ),
  )

  // Shrink when the slot is scrolled mostly under the top bar, grow back when
  // it comes back. The observer says when to look; the slot's box decides,
  // also once an opening ends (scrolls during it are not acted on).
  function checkMini() {
    if (!open() || busy) return
    const r = slot.getBoundingClientRect()
    const bar = shellTop()
    const seen = Math.min(r.bottom, innerHeight) - Math.max(r.top, bar)
    const ratio = r.height > 0 ? Math.max(0, seen) / r.height : 1
    const want = ratio < 0.5 && r.top < bar
    if (want !== mini()) toMini(want)
  }
  createEffect(() => {
    isPhone() // the top bar differs per tier
    const bar = shellTop()
    const io = new IntersectionObserver(() => checkMini(), {
      rootMargin: `-${bar}px 0px 0px 0px`,
      threshold: [0, 0.25, 0.5, 0.75, 1],
    })
    io.observe(slot)
    onCleanup(() => io.disconnect())
  })

  /** Back to the player: scroll to it, then it grows into its place. */
  const backToPlayer = () => {
    const top = host.getBoundingClientRect().top
    scrollToTop(window.scrollY + top - shellTop() - 8)
    if (mini()) toMini(false)
  }

  const onKey = (e: KeyboardEvent) => {
    if (!dockPath() || overlay() || dialogPath() || !e.shiftKey) return
    const target = e.target as HTMLElement | null
    if (target?.closest("input, textarea, select, [contenteditable]")) return
    // movi takes the same keys itself while it has the focus
    if (player && e.composedPath().includes(player)) return
    const k = e.key.toLowerCase()
    if ((k === "n" && go(1)) || (k === "p" && go(-1))) e.preventDefault()
  }
  document.addEventListener("keydown", onKey)
  onCleanup(() => {
    document.removeEventListener("keydown", onKey)
    anchoring(true)
  })

  // Dragging the corner window by its title.
  let dragFrom: [number, number] | undefined
  const onDragDown = (e: PointerEvent) => {
    if (isPhone() || e.button !== 0) return
    e.preventDefault()
    const [x, y] = drag()
    dragFrom = [e.clientX - x, e.clientY - y]
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onDragMove = (e: PointerEvent) => {
    if (!dragFrom) return
    setDrag([e.clientX - dragFrom[0], e.clientY - dragFrom[1]])
  }
  const onDragUp = (e: PointerEvent) => {
    if (!dragFrom) return
    dragFrom = undefined
    // keep the window on screen
    const b = boxOf(frame)
    const [x, y] = drag()
    const dx =
      b.left < 0
        ? -b.left
        : b.left + b.width > innerWidth
          ? innerWidth - b.left - b.width
          : 0
    const dy =
      b.top < shellTop()
        ? shellTop() - b.top
        : b.top + b.height > innerHeight
          ? innerHeight - b.top - b.height
          : 0
    if (dx || dy) setDrag([x + dx, y + dy])
    ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
  }

  const togglePlay = () => {
    if (!player) return
    if (player.paused) void player.play()
    else player.pause()
  }

  const desktopMini = () => mini() && !isPhone()
  const phoneMini = () => mini() && isPhone()

  return (
    <section
      ref={host}
      aria-label={t("home.viewer.player")}
      data-testid="dock"
      data-motion="dock"
      data-open={open() ? "true" : "false"}
      data-mini={mini() ? "true" : "false"}
      inert={!open() || undefined}
      class="w-full shrink-0 overflow-clip rounded-lg"
      style={{ height: "0px" }}
    >
      <div class="bg-black">
        <div
          ref={slot}
          class="relative mx-auto aspect-video"
          style={{
            // the files area's width at 16:9; the one limit is that the video
            // and the title row under it lie whole in the window, and a window
            // too wide for that narrows the video (plan §0.2, 11-28)
            width: `min(100%, max(320px, calc((100dvh - var(--shell-top, 0px) - ${TITLE_ROW + EDGES}px) * 16 / 9)))`,
          }}
        >
          <div
            ref={frame}
            data-testid="dock-frame"
            data-motion="dock-frame"
            class={cn(
              !mini() && "absolute inset-0",
              desktopMini() &&
                "fixed right-4 top-[calc(var(--shell-top,0px)+12px)] z-[1140] flex w-[min(400px,42vw)] flex-col overflow-hidden rounded-lg bg-black shadow-2xl ring-1 ring-white/10",
              phoneMini() &&
                "fixed inset-x-0 top-[var(--shell-top,0px)] z-[1140] flex h-[72px] flex-row border-b bg-background shadow-md",
            )}
            style={
              desktopMini()
                ? { translate: `${drag()[0]}px ${drag()[1]}px` }
                : undefined
            }
          >
            <div
              class={cn(
                "bg-black",
                !mini() && "h-full w-full",
                desktopMini() && "aspect-video w-full",
                phoneMini() && "aspect-video h-full shrink-0",
              )}
            >
              <MoviCore
                path={holding() ? "" : (src()?.path ?? "")}
                rawUrl={src()?.url ?? ""}
                provider={src()?.provider ?? ""}
                fill
                autoplay
                autoNext={autoNext()}
                onNext={() => go(1)}
                onPlayer={onPlayer}
              />
            </div>
            <Show when={mini()}>
              <div
                data-testid="mini-bar"
                class={cn(
                  "flex min-w-0 flex-1 items-center gap-1 px-2",
                  !isPhone() && "h-11 bg-neutral-900 text-white",
                )}
              >
                <span
                  data-drag
                  title={isPhone() ? undefined : t("home.viewer.move")}
                  class={cn(
                    "min-w-0 flex-1 select-none truncate text-sm",
                    !isPhone() && "cursor-move touch-none",
                  )}
                  onPointerDown={onDragDown}
                  onPointerMove={onDragMove}
                  onPointerUp={onDragUp}
                  onPointerCancel={onDragUp}
                >
                  {entry()?.name}
                </span>
                <Show when={isPhone()}>
                  <ToolButton
                    label={
                      paused() ? t("home.viewer.play") : t("home.viewer.pause")
                    }
                    onClick={togglePlay}
                  >
                    {paused() ? (
                      <TbPlayerPlayFilled />
                    ) : (
                      <TbPlayerPauseFilled />
                    )}
                  </ToolButton>
                </Show>
                <ToolButton
                  label={t("home.viewer.back_to_player")}
                  testid="mini-expand"
                  dark={!isPhone()}
                  onClick={backToPlayer}
                >
                  <TbArrowBarToUp />
                </ToolButton>
                <ToolButton
                  label={t("home.viewer.close_player")}
                  testid="mini-close"
                  dark={!isPhone()}
                  onClick={() => closeCurrent(true)}
                >
                  <TbX />
                </ToolButton>
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
          <Show when={index() >= 0}>
            <div class="text-xs text-muted-foreground">
              {t("home.viewer.video_n", {
                index: index() + 1,
                total: videos().length,
              })}
            </div>
          </Show>
        </div>
        <ToolButton
          label={t("home.viewer.previous_key")}
          testid="dock-prev"
          disabled={!prev()}
          onClick={() => go(-1)}
        >
          <TbPlayerSkipBackFilled />
        </ToolButton>
        <ToolButton
          label={t("home.viewer.next_key")}
          testid="dock-next"
          disabled={!next()}
          onClick={() => go(1)}
        >
          <TbPlayerSkipForwardFilled />
        </ToolButton>
        <Show when={!downloadDenied()}>
          <ToolButton
            label={t("files.download")}
            testid="dock-download"
            onClick={() => entry() && downloadObjs([entry()!])}
          >
            <TbDownload />
          </ToolButton>
        </Show>
        <ViewerMore
          obj={entry()}
          path={dockPath()}
          rawUrl={src()?.url}
          current="movi_video"
          testid="dock-more"
          onPreview={(key) =>
            dockPath() && openPath(dockPath()!, { replace: true, preview: key })
          }
        />
        <ToolButton
          label={t("home.viewer.close_player")}
          testid="dock-close"
          onClick={() => closeCurrent()}
        >
          <TbX />
        </ToolButton>
      </div>

      <Show when={episodes().length > 0}>
        <nav
          aria-label={t("home.viewer.episodes")}
          data-testid="episode-bar"
          class="flex gap-2 overflow-x-auto px-3 pb-3 sm:px-4"
        >
          <For each={episodes()}>
            {(ep) => {
              const current = () => entry()?.name === ep.file_name
              return (
                <button
                  type="button"
                  aria-current={current() ? "true" : undefined}
                  class={cn(
                    "flex shrink-0 flex-col items-start rounded-md border px-3 py-1.5 text-left text-sm transition-colors",
                    current()
                      ? "border-primary bg-primary/10 text-primary"
                      : "bg-transparent hover:bg-accent",
                  )}
                  onClick={() =>
                    dockPath() &&
                    openPath(pathJoin(folderOf(dockPath()!), ep.file_name), {
                      replace: true,
                    })
                  }
                >
                  <span class="font-medium">
                    {t("home.viewer.episode_n", { n: ep.episode })}
                  </span>
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
