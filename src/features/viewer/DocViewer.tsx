// The viewer of everything that is neither a video in the dock nor an image:
// text, PDF, audio, office files, archives and the rest of the previews
// (previews/index.ts), each shown by its own preview component, as the file
// page showed them (plan §0.2 查看器; the prototype's DocViewer.tsx). On a
// desktop it is a large window that opens out of the clicked row: laid out at
// its final place and clipped to the row's rectangle, the clip lets go (320ms
// open, 240ms close). On a phone it is a full-screen sheet from the bottom.
import * as DialogPrimitive from "@kobalte/core/dialog"
import { TbDownload, TbX } from "solid-icons/tb"
import {
  createEffect,
  createMemo,
  createSignal,
  ErrorBoundary,
  on,
  onCleanup,
  Show,
  Suspense,
  untrack,
} from "solid-js"
import { Dynamic } from "solid-js/web"
import { Error, FullLoading } from "~/components"
import { SimpleSelect } from "~/components/ui/simple-select"
import { useDownload, useT } from "~/hooks"
import { downloadDenied, ObjStore, objStore, previewDenied } from "~/store"
import { asPreview, isShareContentUrl, probeStatus } from "~/utils"
import { MotionTokens } from "~/platform/motion"
import { getPreviews } from "~/pages/home/previews"
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
  entryOf,
  loaded,
  openWith,
  overlay,
  rowOf,
  takeOrigin,
} from "./state"
import { ToolButton, ViewerMore } from "./ViewerMore"

const nameOf = (path: string) => path.split("/").pop()!

/** The clip that shows only the part of the panel `p` over the row `t`. */
const clipTo = (p: Box, t: Box) => {
  const top = Math.max(0, t.top - p.top)
  const left = Math.max(0, t.left - p.left)
  const right = Math.max(0, p.left + p.width - (t.left + t.width))
  const bottom = Math.max(0, p.top + p.height - (t.top + t.height))
  return `inset(${top}px ${right}px ${bottom}px ${left}px round 8px)`
}
const OPEN_CLIP = "inset(0px 0px 0px 0px round 12px)"

export const DocViewer = () => {
  const t = useT()
  const { downloadObjs } = useDownload()
  const path = () => (overlay()?.kind === "doc" ? overlay()!.path : undefined)
  const [shown, setShown] = createSignal<string>()
  const obj = createMemo(() => entryOf(shown()))
  let scrim: HTMLDivElement | undefined
  let panel: HTMLDivElement | undefined
  let body: HTMLDivElement | undefined
  let closing = false

  // what this file can be shown with, minus what opens elsewhere (the dock,
  // the small dialog); read again when a share turns out to refuse previews
  const previews = createMemo(() => {
    const o = obj()
    if (!o) return []
    previewDenied()
    return getPreviews({ ...o, provider: objStore.provider }).filter(
      (p) => p.key !== "download" && p.key !== "movi_video",
    )
  })
  const cur = createMemo(() => {
    const list = previews()
    const asked = overlay()?.preview
    return list.find((p) => p.key === asked) ?? list[0]
  })

  const fadeScrim = (into: boolean) =>
    void run(
      scrim!,
      { opacity: into ? [0, 1] : [1, 0] },
      MotionTokens.options.scrim,
    )

  const open = async (p: string) => {
    const from = takeOrigin()
    const row = from?.closest("[data-row-name]") ?? from
    const tb = row ? boxOf(row) : undefined
    closing = false
    setShown(p)
    await nextFrame()
    if (!panel || !body) return
    fadeScrim(true)
    if (isPhone() && !reduced()) {
      await run(
        panel,
        { transform: ["translateY(100%)", "translateY(0%)"] },
        MotionTokens.options.viewerSheet,
      )
    } else if (visible(tb)) {
      const pb = boxOf(panel)
      void run(body, { opacity: [0, 1] }, MotionTokens.options.viewerEnter)
      await run(
        panel,
        { clipPath: [clipTo(pb, tb), OPEN_CLIP] },
        MotionTokens.options.viewerEnter,
        [0, 1],
      )
    } else {
      await run(
        panel,
        {
          opacity: [0, 1],
          transform: ["scale(0.96)", "scale(1)"],
        },
        MotionTokens.options.viewerEnter,
      )
    }
  }

  const close = async () => {
    const p = shown()
    if (!p || !panel || closing) return
    closing = true
    const row = rowOf(nameOf(p))
    const tb = row ? boxOf(row) : undefined
    fadeScrim(false)
    if (isPhone() && !reduced()) {
      await run(
        panel,
        { transform: ["translateY(0%)", "translateY(100%)"] },
        MotionTokens.options.viewerExit,
      )
    } else if (visible(tb)) {
      const pb = boxOf(panel)
      void run(body!, { opacity: [1, 0] }, MotionTokens.options.viewerExit)
      await run(
        panel,
        { clipPath: [OPEN_CLIP, clipTo(pb, tb)] },
        MotionTokens.options.viewerExit,
        [1, 0],
      )
    } else {
      await run(
        panel,
        { opacity: [1, 0], transform: ["scale(1)", "scale(0.96)"] },
        MotionTokens.options.viewerExit,
      )
    }
    setShown(undefined)
  }

  createEffect(
    on(path, (p, prev) => {
      if (p && !prev) void open(p)
      else if (p && prev && p !== prev) setShown(p)
      else if (!p && prev) void close()
    }),
  )
  onCleanup(() => setShown(undefined))

  // A preview of a share failed to load: ask the link whether the owner
  // switched previews off (423; a HEAD is never counted), and if so say that
  // instead of the preview's own error.
  let checking = false
  const onMediaError = async () => {
    if (checking || previewDenied() || !isShareContentUrl(objStore.raw_url))
      return
    checking = true
    const status = await probeStatus(asPreview(objStore.raw_url))
    checking = false
    if (status === 423) ObjStore.setShareLimits(false, objStore.allow_download)
  }

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
          data-motion="doc-scrim"
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
            data-motion="doc-panel"
            // the window takes the focus, not its first button, so the first
            // Escape closes it
            onOpenAutoFocus={(e: Event) => {
              e.preventDefault()
              panel?.focus()
            }}
            class={
              isPhone()
                ? "flex h-full w-full flex-col bg-background text-foreground outline-none"
                : "flex h-full max-h-[900px] w-full max-w-[1100px] flex-col overflow-hidden rounded-xl bg-background text-foreground shadow-2xl outline-none"
            }
          >
            <div class="flex h-14 shrink-0 items-center gap-1 border-b px-3">
              <DialogPrimitive.Title class="min-w-0 flex-1 truncate text-sm font-medium">
                {obj()?.name}
              </DialogPrimitive.Title>
              <Show when={previews().length > 1}>
                <SimpleSelect
                  class="w-40 shrink-0"
                  aria-label={t("files.preview_player")}
                  value={cur()?.key ?? ""}
                  onChange={(key) => shown() && openWith(shown()!, key)}
                  options={previews().map((p) => ({
                    value: p.key,
                    label: p.name,
                  }))}
                />
              </Show>
              <Show when={!downloadDenied()}>
                <ToolButton
                  label={t("files.download")}
                  testid="viewer-download"
                  onClick={() => obj() && downloadObjs([obj()!])}
                >
                  <TbDownload />
                </ToolButton>
              </Show>
              <ViewerMore
                obj={obj()}
                path={shown()}
                current={cur()?.key}
                testid="viewer-more"
                onPreview={(key) => shown() && openWith(shown()!, key)}
              />
              <ToolButton
                label={t("home.viewer.close")}
                testid="viewer-close"
                onClick={() => closeCurrent()}
              >
                <TbX />
              </ToolButton>
            </div>
            <div
              ref={(el) => {
                body = el
                // media errors do not bubble: listen while they travel down
                el.addEventListener("error", onMediaError, true)
              }}
              data-motion="doc-body"
              class="min-h-0 flex-1 overflow-auto p-3 sm:p-4"
            >
              <Show when={previewDenied()}>
                <p class="mb-2 text-sm text-muted-foreground">
                  {t("shares.preview_disabled")}
                </p>
              </Show>
              {/* one mount per file and preview: the previews read the file
                  from objStore once it is there (ViewerHost) */}
              <Show
                when={
                  shown() && loaded() === shown() && cur()
                    ? `${shown()}\n${cur()!.key}`
                    : undefined
                }
                keyed
                fallback={<FullLoading />}
              >
                {(_key) => (
                  <ErrorBoundary
                    fallback={(err) => <Error msg={String(err)} />}
                  >
                    <Suspense fallback={<FullLoading />}>
                      <Dynamic component={untrack(cur)?.component} />
                    </Suspense>
                  </ErrorBoundary>
                )}
              </Show>
            </div>
          </DialogPrimitive.Content>
        </div>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
