// The viewer of PDFs, text and audio (§1.3). On a desktop it is a large window
// that opens out of the clicked row: the window is laid out at its final place
// and clipped to the row's rectangle, and the clip lets go (a container
// transform without scaling the text, 02 §三 打开/关闭查看器). On a phone it is
// a full-screen sheet from the bottom, 350ms (03 §七.6).
import {
  Match,
  Show,
  Switch,
  createEffect,
  createSignal,
  on,
  onCleanup,
} from "solid-js"
import * as DialogPrimitive from "@kobalte/core/dialog"
import { useColorMode } from "@hope-ui/solid"
import { TbDownload, TbX } from "solid-icons/tb"
import pdfiumWasmUrl from "@embedpdf/snippet/dist/pdfium.wasm?url"
import { download, linkOf, type Entry } from "./files"
import { boxOf, reducedMotion, run, visible, type Box } from "./motion"
import { closeCurrent, entryAt, overlayPath, takeOrigin } from "./state"
import { IconButton, isPhone } from "./ui"

const TEXT_LIMIT = 256 * 1024

const nextFrame = () => new Promise<number>((r) => requestAnimationFrame(r))

const rowBoxOf = (path: string) => {
  const row = document.querySelector(`[data-path="${CSS.escape(path)}"]`)
  return row ? boxOf(row) : undefined
}

export const DocViewer = () => {
  const { colorMode } = useColorMode()
  const isDoc = () => {
    const k = entryAt(overlayPath())?.kind
    return k === "pdf" || k === "text" || k === "audio"
  }
  const [shown, setShown] = createSignal<Entry>()
  const [text, setText] = createSignal<string>()
  let scrim: HTMLDivElement | undefined
  let panel: HTMLDivElement | undefined
  let body: HTMLDivElement | undefined
  let pdfHost: HTMLDivElement | undefined
  let closing = false

  /** The clip that shows only the part of the panel over the row `t`. */
  const clipTo = (p: Box, t: Box) => {
    const top = Math.max(0, t.top - p.top)
    const left = Math.max(0, t.left - p.left)
    const right = Math.max(0, p.left + p.width - (t.left + t.width))
    const bottom = Math.max(0, p.top + p.height - (t.top + t.height))
    return `inset(${top}px ${right}px ${bottom}px ${left}px round 8px)`
  }
  const openClip = "inset(0px 0px 0px 0px round 12px)"

  const fadeScrim = (into: boolean) =>
    void run(
      into ? "doc-scrim-in" : "doc-scrim-out",
      scrim!,
      into
        ? [{ opacity: 0 }, { opacity: 1 }]
        : [{ opacity: 1 }, { opacity: 0 }],
      "scrim",
      "standard",
      { fill: "forwards" },
    )

  const load = async (e: Entry) => {
    setText(undefined)
    if (e.kind === "text") {
      const r = await fetch(linkOf(e))
      const s = await r.text()
      setText(s.length > TEXT_LIMIT ? s.slice(0, TEXT_LIMIT) : s)
    } else if (e.kind === "pdf" && pdfHost) {
      const { default: EmbedPDF } = await import("@embedpdf/snippet")
      EmbedPDF.init({
        type: "container",
        target: pdfHost,
        src: linkOf(e),
        theme: { preference: colorMode() },
        wasmUrl: new URL(pdfiumWasmUrl, location.origin).href,
      })
    }
  }

  const open = async (e: Entry) => {
    const from = takeOrigin()
    const row = from?.closest("[data-path]") ?? from
    const t = row ? boxOf(row) : undefined
    closing = false
    setShown(e)
    await nextFrame()
    if (!panel || !body) return
    void load(e)
    fadeScrim(true)
    if (reducedMotion()) {
      await run(
        "doc-open",
        panel,
        [{ opacity: 0 }, { opacity: 1 }],
        "viewer-open",
        "standard",
      )
    } else if (isPhone()) {
      await run(
        "doc-open-sheet",
        panel,
        [{ transform: "translateY(100%)" }, { transform: "none" }],
        "viewer-sheet",
        "emphasized-decel",
      )
    } else if (visible(t)) {
      const p = boxOf(panel)
      void run(
        "doc-open-content",
        body,
        [{ opacity: 0 }, { opacity: 1 }],
        "viewer-open",
        "standard",
      )
      await run(
        "doc-open",
        panel,
        [{ clipPath: clipTo(p, t) }, { clipPath: openClip }],
        "viewer-open",
        "emphasized-decel",
      )
    } else {
      await run(
        "doc-open",
        panel,
        [
          { opacity: 0, transform: "scale(0.96)" },
          { opacity: 1, transform: "none" },
        ],
        "viewer-open",
        "emphasized-decel",
      )
    }
  }

  const close = async () => {
    const e = shown()
    if (!e || !panel || closing) return
    closing = true
    const t = rowBoxOf(e.path)
    fadeScrim(false)
    const fill = { fill: "forwards" as const }
    if (reducedMotion()) {
      await run(
        "doc-close",
        panel,
        [{ opacity: 1 }, { opacity: 0 }],
        "viewer-close",
        "standard",
        fill,
      )
    } else if (isPhone()) {
      await run(
        "doc-close-sheet",
        panel,
        [{ transform: "none" }, { transform: "translateY(100%)" }],
        "viewer-close",
        "emphasized-accel",
        fill,
      )
    } else if (visible(t)) {
      const p = boxOf(panel)
      void run(
        "doc-close-content",
        body!,
        [{ opacity: 1 }, { opacity: 0 }],
        "viewer-close",
        "standard",
        fill,
      )
      await run(
        "doc-close",
        panel,
        [{ clipPath: openClip }, { clipPath: clipTo(p, t) }],
        "viewer-close",
        "emphasized-accel",
        fill,
      )
    } else {
      await run(
        "doc-close",
        panel,
        [{ opacity: 1 }, { opacity: 0, transform: "scale(0.96)" }],
        "viewer-close",
        "emphasized-accel",
        fill,
      )
    }
    setShown(undefined)
  }

  createEffect(
    on(
      () => (isDoc() ? overlayPath() : null),
      (p, prevPath) => {
        const e = entryAt(p)
        if (e && !prevPath) void open(e)
        else if (!p && prevPath) void close()
      },
    ),
  )
  onCleanup(() => setShown(undefined))

  return (
    <DialogPrimitive.Root
      open={!!shown()}
      onOpenChange={(o) => {
        if (!o && !closing) closeCurrent()
      }}
    >
      <DialogPrimitive.Portal>
        <div
          ref={scrim}
          class="fixed inset-0 z-[1500] bg-black/60"
          style={{ opacity: 0 }}
        />
        <div
          class={
            isPhone()
              ? "fixed inset-0 z-[1500]"
              : "fixed inset-0 z-[1500] flex items-center justify-center p-8"
          }
        >
          <DialogPrimitive.Content
            ref={panel}
            data-testid="doc-viewer"
            class={
              isPhone()
                ? "flex h-full w-full flex-col bg-background text-foreground outline-none"
                : "flex h-full max-h-[900px] w-full max-w-[1000px] flex-col overflow-hidden rounded-xl bg-background text-foreground shadow-2xl outline-none"
            }
          >
            <div class="flex h-14 shrink-0 items-center gap-1 border-b px-3">
              <DialogPrimitive.Title class="min-w-0 flex-1 truncate text-sm font-medium">
                {shown()?.name}
              </DialogPrimitive.Title>
              <IconButton
                label="下载"
                testid="viewer-download"
                onClick={() => shown() && download(shown()!)}
              >
                <TbDownload />
              </IconButton>
              <IconButton
                label="关闭"
                testid="viewer-close"
                onClick={() => closeCurrent()}
              >
                <TbX />
              </IconButton>
            </div>
            <div ref={body} class="min-h-0 flex-1 overflow-auto">
              <Switch>
                <Match when={shown()?.kind === "text"}>
                  <Show
                    when={text() !== undefined}
                    fallback={
                      <div class="p-6 text-sm text-muted-foreground">
                        读取中…
                      </div>
                    }
                  >
                    <pre
                      data-testid="doc-text"
                      class="whitespace-pre-wrap break-words p-4 font-mono text-sm leading-6 sm:p-6"
                    >
                      {text()}
                    </pre>
                  </Show>
                </Match>
                <Match when={shown()?.kind === "pdf"}>
                  <div
                    ref={pdfHost}
                    data-testid="doc-pdf"
                    class="h-full w-full"
                  />
                </Match>
                <Match when={shown()?.kind === "audio"}>
                  <div class="flex h-full items-center justify-center p-6">
                    <audio
                      controls
                      autoplay
                      src={shown() ? linkOf(shown()!) : undefined}
                      class="w-full max-w-lg"
                    />
                  </div>
                </Match>
              </Switch>
            </div>
          </DialogPrimitive.Content>
        </div>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
