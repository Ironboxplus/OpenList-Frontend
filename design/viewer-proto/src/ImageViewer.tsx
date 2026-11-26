// The image viewer (§1.2): it grows out of the clicked thumbnail and shrinks
// back into the row of the image it closes on (hand-written FLIP, research
// 03 §四), 320ms open / 240ms close on the MD3 emphasized curves, scrim 200ms
// (02 §三). The thumbnail is cropped square in the list, so the image is
// scaled to cover it and clipped to it, then both are let go: the crop opens
// into the whole picture instead of stretching. Previous/next by buttons,
// arrow keys, and a swipe on touch.
import { Show, createEffect, createSignal, on, onCleanup } from "solid-js"
import * as DialogPrimitive from "@kobalte/core/dialog"
import { TbChevronLeft, TbChevronRight, TbDownload, TbX } from "solid-icons/tb"
import { download, linkOf, type Entry } from "./files"
import { boxOf, reducedMotion, run, visible, type Box } from "./motion"
import {
  closeCurrent,
  dir,
  entryAt,
  openEntry,
  overlayPath,
  sibling,
  takeOrigin,
} from "./state"
import { IconButton, isPhone } from "./ui"

const sizes = new Map<string, { w: number; h: number }>()
const naturalSize = async (url: string) => {
  const hit = sizes.get(url)
  if (hit) return hit
  const im = new Image()
  im.src = url
  await im.decode().catch(() => undefined)
  const s = { w: im.naturalWidth || 4, h: im.naturalHeight || 3 }
  sizes.set(url, s)
  return s
}

const originOf = (path: string) =>
  document.querySelector(`[data-path="${CSS.escape(path)}"] [data-origin]`) ??
  undefined

const nextFrame = () => new Promise<number>((r) => requestAnimationFrame(r))

export const ImageViewer = () => {
  const isImage = () => entryAt(overlayPath())?.kind === "image"
  const [shown, setShown] = createSignal<Entry>()
  let stage: HTMLDivElement | undefined
  let scrim: HTMLDivElement | undefined
  let chrome: HTMLDivElement | undefined
  let content: HTMLDivElement | undefined
  let current: { img: HTMLImageElement; box: Box } | undefined
  /** A swipe's distance, so the switch it caused starts where the finger left it. */
  let swipeFrom = 0

  const images = () => dir()?.entries.filter((e) => e.kind === "image") ?? []
  const position = () => {
    const e = shown()
    return e ? `${images().indexOf(e) + 1} / ${images().length}` : ""
  }

  /** Where an image of this shape sits: contained in the stage. */
  const fit = (s: { w: number; h: number }): Box => {
    const st = boxOf(stage!)
    const k = Math.min(st.width / s.w, st.height / s.h)
    const w = s.w * k
    const h = s.h * k
    return {
      left: st.left + (st.width - w) / 2,
      top: st.top + (st.height - h) / 2,
      width: w,
      height: h,
    }
  }

  /**
   * The <img> of an entry at its place. A row with a thumbnail gives the shape
   * at once and the first picture; the full one replaces it when decoded.
   */
  const place = async (e: Entry) => {
    const full = linkOf(e)
    const thumb = originOf(e.path)
    const fromThumb =
      thumb instanceof HTMLImageElement &&
      thumb.complete &&
      thumb.naturalWidth > 0
    const shape = fromThumb
      ? { w: thumb.naturalWidth, h: thumb.naturalHeight }
      : await naturalSize(full)
    const box = fit(shape)
    const st = boxOf(stage!)
    const img = document.createElement("img")
    img.alt = e.name
    img.draggable = false
    img.dataset.testid = "viewer-image"
    img.className = "absolute select-none"
    Object.assign(img.style, {
      left: `${box.left - st.left}px`,
      top: `${box.top - st.top}px`,
      width: `${box.width}px`,
      height: `${box.height}px`,
      transformOrigin: "50% 50%",
    })
    img.src = fromThumb ? thumb.src : full
    stage!.append(img)
    if (fromThumb) {
      const hi = new Image()
      hi.src = full
      void hi.decode().then(
        () => (img.src = full),
        () => undefined,
      )
    }
    // the next and previous one are on hand when asked for (03 §七.3)
    for (const step of [1, -1] as const) {
      const n = sibling(e.path, step)
      if (n) new Image().src = linkOf(n)
    }
    return { img, box }
  }

  /** translate + scale + clip that lay the image over the thumbnail box `t`. */
  const overThumb = (b: Box, t: Box): Keyframe => {
    const s = Math.max(t.width / b.width, t.height / b.height)
    const ix = Math.max(0, (b.width - t.width / s) / 2)
    const iy = Math.max(0, (b.height - t.height / s) / 2)
    const dx = t.left + t.width / 2 - (b.left + b.width / 2)
    const dy = t.top + t.height / 2 - (b.top + b.height / 2)
    return {
      transform: `translate(${dx}px, ${dy}px) scale(${s})`,
      clipPath: `inset(${iy}px ${ix}px round ${6 / s}px)`,
    }
  }
  const settled: Keyframe = {
    transform: "none",
    clipPath: "inset(0px 0px round 0px)",
  }

  const fadeChrome = (into: boolean) => {
    const kf = into
      ? [{ opacity: 0 }, { opacity: 1 }]
      : [{ opacity: 1 }, { opacity: 0 }]
    const fill = { fill: "forwards" as const }
    const tag = into ? "in" : "out"
    void run(`image-scrim-${tag}`, scrim!, kf, "scrim", "standard", fill)
    void run(`image-chrome-${tag}`, chrome!, kf, "scrim", "standard", fill)
  }

  const open = async (e: Entry) => {
    const from = takeOrigin()
    const t = from ? boxOf(from) : undefined
    setShown(e)
    await nextFrame() // the portal is laid out
    if (!stage) return
    current = await place(e)
    const { img, box } = current
    fadeChrome(true)
    if (reducedMotion() || !visible(t)) {
      await run(
        "image-open",
        img,
        [{ opacity: 0 }, { opacity: 1 }],
        "viewer-open",
        "standard",
      )
      return
    }
    await run(
      "image-open",
      img,
      [overThumb(box, t), settled],
      "viewer-open",
      "emphasized-decel",
    )
  }

  const close = async () => {
    const e = shown()
    const c = current
    current = undefined
    if (!e || !c) {
      setShown(undefined)
      return
    }
    const o = originOf(e.path)
    const t = o ? boxOf(o) : undefined
    fadeChrome(false)
    if (reducedMotion() || !visible(t)) {
      const end = reducedMotion()
        ? { opacity: 0 }
        : { opacity: 0, transform: "scale(0.96)" }
      await run(
        "image-close",
        c.img,
        [{ opacity: 1 }, end],
        "viewer-close",
        "emphasized-accel",
        {
          fill: "forwards",
        },
      )
    } else {
      await run(
        "image-close",
        c.img,
        [settled, overThumb(c.box, t)],
        "viewer-close",
        "emphasized-accel",
        {
          fill: "forwards",
        },
      )
    }
    setShown(undefined)
  }

  const switchTo = async (e: Entry, step: number) => {
    const old = current
    const d = step > 0 ? 1 : -1
    const from = swipeFrom
    swipeFrom = 0
    setShown(e)
    if (old) {
      const out = reducedMotion()
        ? [{ opacity: 1 }, { opacity: 0 }]
        : [
            { opacity: 1, transform: `translateX(${from}px)` },
            { opacity: 0, transform: `translateX(${from - d * 64}px)` },
          ]
      void run("image-switch-out", old.img, out, "viewer-switch", "standard", {
        fill: "forwards",
      }).then(() => old.img.remove())
    }
    current = await place(e)
    const into = reducedMotion()
      ? [{ opacity: 0 }, { opacity: 1 }]
      : [
          { opacity: 0, transform: `translateX(${d * 64}px)` },
          { opacity: 1, transform: "none" },
        ]
    await run("image-switch-in", current.img, into, "viewer-switch", "standard")
  }

  createEffect(
    on(
      () => (isImage() ? overlayPath() : null),
      (p, prevPath) => {
        const e = entryAt(p)
        if (e && !prevPath) void open(e)
        else if (e && prevPath && prevPath !== p) {
          const list = images()
          const step =
            list.indexOf(e) - list.findIndex((x) => x.path === prevPath)
          void switchTo(e, step)
        } else if (!p && prevPath) void close()
      },
    ),
  )

  const go = (step: 1 | -1) => {
    const e = shown()
    const n = e && sibling(e.path, step)
    if (n) openEntry(n, "replace")
    return !!n
  }

  // Swipe on touch: the image follows the finger, a long enough pull switches.
  let startX = 0
  let dragging = false
  let moved = false
  const onDown = (ev: PointerEvent) => {
    if (ev.pointerType === "mouse" || !current) return
    dragging = true
    moved = false
    startX = ev.clientX
    try {
      stage!.setPointerCapture(ev.pointerId)
    } catch {
      // a pointer the browser does not track (a synthetic one) is followed without
    }
  }
  const onMove = (ev: PointerEvent) => {
    if (!dragging || !current) return
    const dx = ev.clientX - startX
    if (Math.abs(dx) > 6) moved = true
    current.img.style.transform = `translateX(${dx}px)`
  }
  const onUp = (ev: PointerEvent) => {
    if (!dragging || !current) return
    dragging = false
    const dx = ev.clientX - startX
    const img = current.img
    img.style.transform = ""
    if (Math.abs(dx) > Math.min(80, window.innerWidth * 0.15)) {
      swipeFrom = dx
      if (go(dx < 0 ? 1 : -1)) return
      swipeFrom = 0
    }
    void run(
      "image-swipe-back",
      img,
      [{ transform: `translateX(${dx}px)` }, { transform: "none" }],
      "viewer-switch",
      "standard",
    )
  }

  const onKey = (ev: KeyboardEvent) => {
    if (ev.key === "ArrowRight" && go(1)) ev.preventDefault()
    if (ev.key === "ArrowLeft" && go(-1)) ev.preventDefault()
  }

  onCleanup(() => current?.img.remove())

  return (
    <DialogPrimitive.Root
      open={!!shown()}
      onOpenChange={(o) => {
        if (!o && current) closeCurrent()
      }}
    >
      <DialogPrimitive.Portal>
        <div
          ref={scrim}
          class="fixed inset-0 z-[1500] bg-black/95"
          style={{ opacity: 0 }}
        />
        <DialogPrimitive.Content
          ref={content}
          class="fixed inset-0 z-[1500] outline-none"
          data-testid="image-viewer"
          onKeyDown={onKey}
          // the viewer itself takes the focus, not its first button: a
          // focused icon button shows its tooltip, and Escape would close
          // that instead of the viewer
          onOpenAutoFocus={(e: Event) => {
            e.preventDefault()
            content?.focus()
          }}
        >
          <DialogPrimitive.Title class="sr-only">
            {shown()?.name}
          </DialogPrimitive.Title>
          <div
            ref={stage}
            data-testid="image-stage"
            class={
              isPhone()
                ? "absolute inset-x-0 bottom-0 top-14 touch-pan-y"
                : "absolute inset-x-16 bottom-6 top-16"
            }
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            onClick={(ev) => {
              if (moved) {
                moved = false
                return
              }
              if (ev.target === ev.currentTarget) closeCurrent()
            }}
          />
          <div ref={chrome} style={{ opacity: 0 }}>
            <div class="absolute inset-x-0 top-0 flex h-14 items-center gap-1 bg-gradient-to-b from-black/70 to-transparent px-3 text-white">
              <div class="min-w-0 flex-1">
                <div class="truncate text-sm font-medium">{shown()?.name}</div>
                <div
                  class="text-xs tabular-nums text-white/70"
                  data-testid="image-index"
                >
                  {position()}
                </div>
              </div>
              <IconButton
                label="下载"
                testid="viewer-download"
                onDark
                onClick={() => shown() && download(shown()!)}
              >
                <TbDownload />
              </IconButton>
              <IconButton
                label="关闭"
                testid="viewer-close"
                onDark
                onClick={() => closeCurrent()}
              >
                <TbX />
              </IconButton>
            </div>
            <Show when={!isPhone()}>
              <IconButton
                label="上一张 (←)"
                testid="image-prev"
                onDark
                disabled={!shown() || !sibling(shown()!.path, -1)}
                class="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/40"
                onClick={() => go(-1)}
              >
                <TbChevronLeft />
              </IconButton>
              <IconButton
                label="下一张 (→)"
                testid="image-next"
                onDark
                disabled={!shown() || !sibling(shown()!.path, 1)}
                class="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/40"
                onClick={() => go(1)}
              >
                <TbChevronRight />
              </IconButton>
            </Show>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
