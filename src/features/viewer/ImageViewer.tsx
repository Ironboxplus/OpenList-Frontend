// The image viewer (plan §0.2 查看器; the prototype's ImageViewer.tsx, run
// 45866187867). It grows out of the clicked row's thumbnail and shrinks back
// into the row of the image it closes on (a hand-written FLIP), 320ms open and
// 240ms close on the MD3 emphasized curves, the 95% black scrim in 200ms. The
// thumbnail is cropped in the list, so the image is scaled to cover it and
// clipped to it, then both are let go: the crop opens into the whole picture
// instead of stretching. Previous/next by buttons, arrow keys and a swipe; each
// replaces the address.
import * as DialogPrimitive from "@kobalte/core/dialog"
import { TbChevronLeft, TbChevronRight, TbDownload, TbX } from "solid-icons/tb"
import {
  createEffect,
  createMemo,
  createSignal,
  on,
  onCleanup,
  Show,
} from "solid-js"
import { useDownload, useLink, useT } from "~/hooks"
import { downloadDenied, objStore } from "~/store"
import type { Obj } from "~/types"
import { MotionTokens } from "~/platform/motion"
import {
  boxOf,
  isPhone,
  nextFrame,
  reduced,
  run,
  visible,
  type Box,
} from "./motion"
import {
  closeCurrent,
  drawable,
  entryOf,
  openWith,
  overlay,
  rowOf,
  sibling,
  step,
  takeOrigin,
} from "./state"
import { ToolButton, ViewerMore } from "./ViewerMore"

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

const nameOf = (path: string) => path.split("/").pop()!

/** The thumbnail of a file's row, or the row itself. */
const originOf = (name: string) => {
  const row = rowOf(name)
  return row?.querySelector("[data-origin]") ?? row
}

/** translate + scale + clip that lay the image box `b` over the thumbnail box `t`. */
const overThumb = (b: Box, t: Box) => {
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
// explicit identity values: "none" does not interpolate with a translate+scale
const SETTLED = {
  transform: "translate(0px, 0px) scale(1)",
  clipPath: "inset(0px 0px round 0px)",
}

export const ImageViewer = () => {
  const t = useT()
  const { previewLink } = useLink()
  const { downloadObjs } = useDownload()
  const path = () => (overlay()?.kind === "image" ? overlay()!.path : undefined)
  const [shown, setShown] = createSignal<string>()
  const obj = createMemo(() => entryOf(shown()))
  let stage: HTMLDivElement | undefined
  let scrim: HTMLDivElement | undefined
  let chrome: HTMLDivElement | undefined
  let content: HTMLDivElement | undefined
  let current: { img: HTMLImageElement; box: Box } | undefined
  /** A swipe's distance, so the switch it caused starts where the finger left it. */
  let swipeFrom = 0
  let seq = 0

  const images = () => objStore.objs.filter((o) => !o.is_dir && drawable(o))
  const position = () => {
    const name = shown() && nameOf(shown()!)
    const list = images()
    const i = list.findIndex((o) => o.name === name)
    return i < 0 ? "" : `${i + 1} / ${list.length}`
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
   * The <img> of a file at its place. A row with a thumbnail gives the shape
   * at once and the first picture; the full one replaces it when decoded.
   */
  const place = async (o: Obj, p: string) => {
    const full = previewLink(o)
    const thumb = originOf(o.name)
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
    img.alt = o.name
    img.draggable = false
    img.dataset.testid = "viewer-image"
    img.dataset.motion = "viewer-image"
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
    if (fromThumb && thumb.src !== full) {
      const hi = new Image()
      hi.src = full
      void hi.decode().then(
        () => (img.src = full),
        () => undefined,
      )
    }
    // the next and previous ones are on hand when asked for
    for (const by of [1, -1] as const) {
      const n = sibling(p, by, drawable)
      if (n) new Image().src = previewLink(n)
    }
    return { img, box }
  }

  const fadeChrome = (into: boolean) => {
    const opacity = into ? [0, 1] : [1, 0]
    for (const el of [scrim!, chrome!])
      void run(el, { opacity }, MotionTokens.options.scrim)
  }

  const open = async (p: string) => {
    const from = takeOrigin()
    const fromThumb = from?.querySelector("[data-origin]") ?? from
    const tb = fromThumb ? boxOf(fromThumb) : undefined
    const my = ++seq
    setShown(p)
    await nextFrame() // the portal is laid out
    const o = entryOf(p)
    if (!stage || !o || my !== seq) return
    current = await place(o, p)
    if (my !== seq) return
    const { img, box } = current
    fadeChrome(true)
    if (reduced() || !visible(tb)) {
      await run(img, { opacity: [0, 1] }, MotionTokens.options.viewerEnter)
      return
    }
    const from0 = overThumb(box, tb)
    await run(
      img,
      {
        transform: [from0.transform, SETTLED.transform],
        clipPath: [from0.clipPath, SETTLED.clipPath],
      },
      MotionTokens.options.viewerEnter,
    )
  }

  const close = async () => {
    const p = shown()
    const c = current
    current = undefined
    seq++
    if (!p || !c) {
      setShown(undefined)
      return
    }
    const o = originOf(nameOf(p))
    const tb = o ? boxOf(o) : undefined
    fadeChrome(false)
    if (reduced() || !visible(tb)) {
      await run(
        c.img,
        {
          opacity: [1, 0],
          transform: [SETTLED.transform, "translate(0px, 0px) scale(0.96)"],
        },
        MotionTokens.options.viewerExit,
      )
    } else {
      const to = overThumb(c.box, tb)
      await run(
        c.img,
        {
          transform: [SETTLED.transform, to.transform],
          clipPath: [SETTLED.clipPath, to.clipPath],
        },
        MotionTokens.options.viewerExit,
        [1, 0],
      )
    }
    setShown(undefined)
    c.img.remove()
  }

  const switchTo = async (p: string, by: number) => {
    const old = current
    const d = by > 0 ? 1 : -1
    const from = swipeFrom
    swipeFrom = 0
    const my = ++seq
    setShown(p)
    if (old) {
      void run(
        old.img,
        {
          opacity: [1, 0],
          transform: [
            `translateX(${from}px)`,
            `translateX(${from - d * 64}px)`,
          ],
        },
        MotionTokens.options.viewerSwitch,
      ).then(() => old.img.remove())
    }
    const o = entryOf(p)
    if (!o) return
    const next = await place(o, p)
    if (my !== seq) {
      next.img.remove()
      return
    }
    current = next
    await run(
      next.img,
      {
        opacity: [0, 1],
        transform: [`translateX(${d * 64}px)`, "translateX(0px)"],
      },
      MotionTokens.options.viewerSwitch,
    )
  }

  createEffect(
    on(path, (p, prev) => {
      if (p && !prev) void open(p)
      else if (p && prev && p !== prev) {
        const list = images()
        const by =
          list.findIndex((o) => o.name === nameOf(p)) -
          list.findIndex((o) => o.name === nameOf(prev))
        void switchTo(p, by)
      } else if (!p && prev) void close()
    }),
  )

  const go = (by: 1 | -1) => {
    const p = shown()
    return !!p && step(p, by, drawable)
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
      img,
      { transform: [`translateX(${dx}px)`, "translateX(0px)"] },
      MotionTokens.options.viewerSwitch,
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
          data-motion="viewer-scrim"
          class="fixed inset-0 z-[1500] bg-black/95"
          style={{ opacity: 0 }}
        />
        <DialogPrimitive.Content
          ref={content}
          class="fixed inset-0 z-[1500] outline-none"
          data-testid="image-viewer"
          onKeyDown={onKey}
          // the viewer itself takes the focus, not its first button, so the
          // first Escape closes it
          onOpenAutoFocus={(e: Event) => {
            e.preventDefault()
            content?.focus()
          }}
        >
          <DialogPrimitive.Title class="sr-only">
            {obj()?.name}
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
          <div ref={chrome} data-motion="viewer-chrome" style={{ opacity: 0 }}>
            <div class="absolute inset-x-0 top-0 flex h-14 items-center gap-1 bg-gradient-to-b from-black/70 to-transparent px-3 text-white">
              <div class="min-w-0 flex-1">
                <div class="truncate text-sm font-medium">{obj()?.name}</div>
                <div
                  class="text-xs tabular-nums text-white/70"
                  data-testid="image-index"
                >
                  {position()}
                </div>
              </div>
              <Show when={!downloadDenied()}>
                <ToolButton
                  label={t("files.download")}
                  testid="viewer-download"
                  dark
                  onClick={() => obj() && downloadObjs([obj()!])}
                >
                  <TbDownload />
                </ToolButton>
              </Show>
              <ViewerMore
                obj={obj()}
                path={shown()}
                current="image"
                testid="viewer-more"
                dark
                onPreview={(key) => shown() && openWith(shown()!, key)}
              />
              <ToolButton
                label={t("home.viewer.close")}
                testid="viewer-close"
                dark
                onClick={() => closeCurrent()}
              >
                <TbX />
              </ToolButton>
            </div>
            <Show when={!isPhone()}>
              <ToolButton
                label={t("home.viewer.previous_image")}
                testid="image-prev"
                dark
                disabled={!shown() || !sibling(shown()!, -1, drawable)}
                class="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/40"
                onClick={() => go(-1)}
              >
                <TbChevronLeft />
              </ToolButton>
              <ToolButton
                label={t("home.viewer.next_image")}
                testid="image-next"
                dark
                disabled={!shown() || !sibling(shown()!, 1, drawable)}
                class="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/40"
                onClick={() => go(1)}
              >
                <TbChevronRight />
              </ToolButton>
            </Show>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
