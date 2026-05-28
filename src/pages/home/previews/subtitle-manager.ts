import type { PgsRenderer } from "libpgs"

export type SubtitleFormat = "ass" | "sup" | "srt" | "vtt"
export type ActiveRenderer = "ass" | "sup" | "none"

export interface SubtitleFile {
  name: string
  url: string
}

interface SubtitleInfo {
  lang: string
  label: string
  url: string
  format: SubtitleFormat
}

const isDev = import.meta.env?.DEV ?? false

function log(...args: unknown[]) {
  if (isDev) console.log("[SubtitleManager]", ...args)
}

const escapeAttr = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;")

function srtToVtt(srt: string): string {
  const body = srt
    .replace(/\r\n/g, "\n")
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2")
  return "WEBVTT\n\n" + body
}

export function detectFormat(filename: string): SubtitleFormat {
  const ext = filename.split(".").pop()?.toLowerCase() ?? ""
  switch (ext) {
    case "ass":
      return "ass"
    case "sup":
      return "sup"
    case "srt":
      return "srt"
    case "vtt":
      return "vtt"
    default:
      return "vtt"
  }
}

export class SubtitleManager {
  private moviEl: HTMLElement
  private subInfoMap = new Map<string, SubtitleInfo>()
  private activeRenderer: ActiveRenderer = "none"
  private assRenderer: any | null = null
  private pgsRenderer: PgsRenderer | null = null
  private syncTimer: number | undefined
  private overlayCanvas: HTMLCanvasElement | null = null
  private resizeObserver: ResizeObserver | null = null
  private timeOffset = 0
  private destroyed = false
  private lastActiveLang: string | null = null
  private pollTimer: number | undefined
  private fullscreenRequestHandler: ((e: Event) => void) | null = null
  private fullscreenChangeHandler: (() => void) | null = null

  constructor(moviEl: HTMLElement) {
    this.moviEl = moviEl
    if (moviEl) this.setupFullscreenIntercept()
  }

  private setupFullscreenIntercept(): void {
    this.fullscreenRequestHandler = (e: Event) => {
      e.preventDefault()
      const wrapper = this.moviEl.parentElement
      if (!wrapper) return

      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {})
      } else {
        wrapper.requestFullscreen().catch(() => {})
      }
    }
    this.moviEl.addEventListener(
      "movi-fullscreen-request",
      this.fullscreenRequestHandler,
    )

    this.fullscreenChangeHandler = () => {
      const wrapper = this.moviEl.parentElement
      const isFs = document.fullscreenElement === wrapper
      ;(this.moviEl as any).setHostFullscreen?.(isFs)
    }
    document.addEventListener("fullscreenchange", this.fullscreenChangeHandler)
  }

  registerTracks(files: SubtitleFile[]): void {
    this.subInfoMap.clear()
    log("registerTracks:", files.length, "files")
    files.forEach((file, i) => {
      const lang = `sub${i}`
      this.subInfoMap.set(lang, {
        lang,
        label: file.name,
        url: file.url,
        format: detectFormat(file.name),
      })
    })
  }

  async convertSrtTracks(): Promise<void> {
    const tasks: Promise<void>[] = []
    for (const [, info] of this.subInfoMap) {
      if (info.format !== "srt") continue
      tasks.push(
        fetch(info.url)
          .then((r) => r.text())
          .then((srt) => {
            const vtt = srtToVtt(srt)
            const blob = new Blob([vtt], { type: "text/vtt" })
            info.url = URL.createObjectURL(blob)
            info.format = "vtt"
            log("converted SRT→VTT for", info.label)
          })
          .catch((e) => log("SRT conversion failed for", info.label, e)),
      )
    }
    await Promise.all(tasks)
  }

  getTrackHTML(): string {
    return Array.from(this.subInfoMap.values())
      .map(
        (info) =>
          `<track kind="subtitles" src="${escapeAttr(info.url)}" srclang="${info.lang}" label="${escapeAttr(info.label)}" data-format="${info.format}">`,
      )
      .join("")
  }

  getTrackCount(): number {
    return this.subInfoMap.size
  }

  getActiveRenderer(): ActiveRenderer {
    return this.activeRenderer
  }

  getTimeOffset(): number {
    return this.timeOffset
  }

  handleTrackChange(): void {
    if (this.destroyed) return
    log("handleTrackChange triggered")

    const langs = (this.moviEl as any).getSubtitleLangs?.() as
      | Array<{ lang: string; label: string; active: boolean }>
      | undefined
    const active = langs?.find((t) => t.active)

    this.destroyRenderers()

    if (!active) return

    const info = this.subInfoMap.get(active.lang)
    if (!info) return

    if (info.format === "ass") {
      this.activeRenderer = "ass"
      log("activating ASS renderer for", info.label)
      this.activateASS(info.url)
    } else if (info.format === "sup") {
      this.activeRenderer = "sup"
      log("activating SUP renderer for", info.label)
      this.activateSUP(info.url)
    }
    // srt is pre-converted to vtt by convertSrtTracks(), vtt handled natively
  }

  setTimeOffset(seconds: number): void {
    this.timeOffset = seconds
    if (this.assRenderer) {
      ;(this.assRenderer as any).timeOffset = seconds
    }
    if (this.pgsRenderer) {
      this.pgsRenderer.timeOffset = seconds
    }
  }

  startPolling(): void {
    if (this.pollTimer) return
    log("startPolling for subtitle track changes")
    this.pollTimer = window.setInterval(() => {
      if (this.destroyed) return
      const langs = (this.moviEl as any).getSubtitleLangs?.() as
        | Array<{ lang: string; label: string; active: boolean }>
        | undefined
      const active = langs?.find((t) => t.active)
      const activeLang = active?.lang ?? null
      if (activeLang !== this.lastActiveLang) {
        log("detected track change:", this.lastActiveLang, "→", activeLang)
        this.lastActiveLang = activeLang
        this.handleTrackChange()
      }
    }, 500)
  }

  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    log("destroy")
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = undefined
    }
    if (this.fullscreenRequestHandler) {
      this.moviEl.removeEventListener(
        "movi-fullscreen-request",
        this.fullscreenRequestHandler,
      )
      this.fullscreenRequestHandler = null
    }
    if (this.fullscreenChangeHandler) {
      document.removeEventListener(
        "fullscreenchange",
        this.fullscreenChangeHandler,
      )
      this.fullscreenChangeHandler = null
    }
    this.destroyRenderers()
    this.subInfoMap.clear()
  }

  private async activateASS(url: string): Promise<void> {
    const canvas = this.getOrCreateOverlay()
    log("activateASS: JASSUB for:", url)

    const { default: JASSUB } = await import("jassub")
    const jassubWorkerUrl = (
      await import("jassub/dist/worker/worker.js?worker&url")
    ).default
    const jassubWasmUrl = (
      await import("jassub/dist/wasm/jassub-worker.wasm?url")
    ).default
    const jassubModernWasmUrl = (
      await import("jassub/dist/wasm/jassub-worker-modern.wasm?url")
    ).default

    const dynamicBase = (window as any).__dynamic_base__ || ""
    const fontBase = `${window.location.origin}${dynamicBase}/static/fonts`

    this.assRenderer = new JASSUB({
      canvas,
      subUrl: url,
      workerUrl: jassubWorkerUrl,
      wasmUrl: jassubWasmUrl,
      modernWasmUrl: jassubModernWasmUrl,
      defaultFont: "source han sans cn",
      availableFonts: {
        "source han sans cn": `${fontBase}/SourceHanSansCN-Bold.woff2`,
        "times new roman": `${fontBase}/TimesNewRoman.ttf`,
      },
    }) as any
    await (this.assRenderer as any).ready
    if (this.timeOffset !== 0) {
      ;(this.assRenderer as any).timeOffset = this.timeOffset
    }
    this.startSync()
  }

  private async activateSUP(url: string): Promise<void> {
    const canvas = this.getOrCreateOverlay()
    const dynamicBase = (window as any).__dynamic_base__ || ""
    const origin = window.location.origin
    const base = `${origin}${dynamicBase}/static`

    const { PgsRenderer } = await import("libpgs")
    log("libpgs init with workerUrl:", `${base}/libpgs/libpgs.worker.js`)
    this.pgsRenderer = new PgsRenderer({
      canvas,
      subUrl: url,
      workerUrl: `${base}/libpgs/libpgs.worker.js`,
    })
    if (this.timeOffset !== 0) {
      this.pgsRenderer.timeOffset = this.timeOffset
    }
    this.startSync()
  }

  private getOrCreateOverlay(): HTMLCanvasElement {
    if (this.overlayCanvas) return this.overlayCanvas

    const wrapper = this.moviEl.parentElement!
    wrapper.style.position = "relative"

    this.overlayCanvas = document.createElement("canvas")
    this.overlayCanvas.width = this.moviEl.clientWidth || 0
    this.overlayCanvas.height = this.moviEl.clientHeight || 0
    this.overlayCanvas.style.cssText = `
      position: absolute;
      top: 0; left: 0;
      width: 100%; height: 100%;
      pointer-events: none;
      z-index: 10;
    `
    wrapper.insertBefore(this.overlayCanvas, this.moviEl.nextSibling)

    this.resizeObserver = new ResizeObserver(() => {
      if (!this.overlayCanvas) return
      const w = this.moviEl.clientWidth || 0
      const h = this.moviEl.clientHeight || 0
      this.overlayCanvas.width = w
      this.overlayCanvas.height = h
      log("resize overlay to", w, "x", h)
    })
    this.resizeObserver.observe(this.moviEl)

    return this.overlayCanvas
  }

  private startSync(): void {
    if (this.syncTimer) clearInterval(this.syncTimer)
    this.syncTimer = window.setInterval(() => {
      const time = (this.moviEl as any).currentTime
      if (typeof time !== "number") return

      if (this.assRenderer && !(this.assRenderer as any)._destroyed) {
        const w = this.moviEl.clientWidth || 0
        const h = this.moviEl.clientHeight || 0
        ;(this.assRenderer as any).manualRender({
          expectedDisplayTime: performance.now(),
          width: w,
          height: h,
          mediaTime: time,
        })
      }

      if (this.pgsRenderer) {
        this.pgsRenderer.renderAtTimestamp(time)
      }
    }, 50)
  }

  private destroyRenderers(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer)
      this.syncTimer = undefined
    }
    if (this.assRenderer) {
      if (!(this.assRenderer as any)._destroyed) {
        ;(this.assRenderer as any).destroy()
      }
      this.assRenderer = null
    }
    if (this.pgsRenderer) {
      this.pgsRenderer.dispose()
      this.pgsRenderer = null
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect()
      this.resizeObserver = null
    }
    if (this.overlayCanvas) {
      this.overlayCanvas.remove()
      this.overlayCanvas = null
    }
    this.activeRenderer = "none"
  }
}
