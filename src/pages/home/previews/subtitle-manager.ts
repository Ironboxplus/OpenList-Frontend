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

// JASSUB/libass only parse UTF-8. Detect a UTF-16 BOM and transcode to UTF-8,
// stripping the BOM char. Returns null when the bytes are already UTF-8 (with or
// without BOM), signalling the caller to leave the source untouched.
export function utf16ToUtf8IfNeeded(buf: ArrayBuffer): string | null {
  const b = new Uint8Array(buf)
  let text: string | null = null
  if (b[0] === 0xff && b[1] === 0xfe) {
    text = new TextDecoder("utf-16le").decode(buf)
  } else if (b[0] === 0xfe && b[1] === 0xff) {
    text = new TextDecoder("utf-16be").decode(buf)
  }
  if (text === null) return null
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)
  return text
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
  private jassubCanvas: HTMLCanvasElement | null = null
  private displayCtx: CanvasRenderingContext2D | null = null
  private copyFrameId: number | undefined
  private resizeObserver: ResizeObserver | null = null
  private timeOffset = 0
  private destroyed = false
  private lastActiveLang: string | null = null
  private pollTimer: number | undefined
  private fullscreenChangeHandler: (() => void) | null = null
  private activationSeq = 0

  constructor(moviEl: HTMLElement) {
    this.moviEl = moviEl
    if (moviEl) this.setupFullscreenWatch()
  }

  private setupFullscreenWatch(): void {
    this.fullscreenChangeHandler = () => {
      if (!this.overlayCanvas) return
      const fsEl = document.fullscreenElement
      if (fsEl === this.moviEl) {
        this.moviEl.shadowRoot?.appendChild(this.overlayCanvas)
      } else if (!fsEl && this.overlayCanvas.getRootNode() !== document) {
        this.moviEl.shadowRoot?.appendChild(this.overlayCanvas)
      }
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

  // JASSUB/libass only parse UTF-8. Many fansub .ass files (e.g. popgo) are
  // UTF-16 — libass then fails with "Failed to start a track" and nothing
  // renders, on every source. Detect a UTF-16 BOM, transcode to a UTF-8 blob,
  // and repoint the track url so JASSUB can load it. UTF-8 (with or without BOM)
  // is left untouched.
  async convertAssTracks(): Promise<void> {
    const tasks: Promise<void>[] = []
    for (const [, info] of this.subInfoMap) {
      if (info.format !== "ass") continue
      tasks.push(
        fetch(info.url)
          .then((r) => r.arrayBuffer())
          .then((buf) => {
            const text = utf16ToUtf8IfNeeded(buf)
            if (text === null) return // already UTF-8 (or BOM-less) — leave as-is
            const blob = new Blob([text], { type: "text/plain" })
            info.url = URL.createObjectURL(blob)
            log("converted UTF-16 ASS→UTF-8 for", info.label)
          })
          .catch((e) =>
            log("ASS encoding conversion failed for", info.label, e),
          ),
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
    const activationSeq = ++this.activationSeq

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
      void this.activateASS(info.url, activationSeq).catch((e) => {
        if (!this.isActivationCurrent(activationSeq)) return
        log("ASS renderer activation failed", e)
        this.destroyRenderers()
      })
    } else if (info.format === "sup") {
      this.activeRenderer = "sup"
      log("activating SUP renderer for", info.label)
      void this.activateSUP(info.url, activationSeq).catch((e) => {
        if (!this.isActivationCurrent(activationSeq)) return
        log("SUP renderer activation failed", e)
        this.destroyRenderers()
      })
    }
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

  private isActivationCurrent(seq: number): boolean {
    return !this.destroyed && this.activationSeq === seq
  }

  private async activateASS(url: string, seq: number): Promise<void> {
    if (!this.isActivationCurrent(seq)) return
    this.ensureOverlay()
    const jassubTarget = this.getOrCreateJassubCanvas()
    log("activateASS: JASSUB (double-canvas) for:", url)

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
    if (!this.isActivationCurrent(seq) || typeof window === "undefined") {
      return
    }

    const dynamicBase = (window as any).__dynamic_base__ || ""
    const fontBase = `${window.location.origin}${dynamicBase}/static/fonts`

    const renderer = new JASSUB({
      canvas: jassubTarget,
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
    this.assRenderer = renderer
    await renderer.ready
    if (!this.isActivationCurrent(seq)) {
      if (!renderer._destroyed) renderer.destroy()
      return
    }
    if (this.timeOffset !== 0) {
      renderer.timeOffset = this.timeOffset
    }
    this.startSync()
    this.startCopyLoop()
  }

  private async activateSUP(url: string, seq: number): Promise<void> {
    if (!this.isActivationCurrent(seq)) return
    this.ensureOverlay()
    if (!this.isActivationCurrent(seq) || typeof window === "undefined") return
    const dynamicBase = (window as any).__dynamic_base__ || ""
    const origin = window.location.origin
    const base = `${origin}${dynamicBase}/static`

    const { PgsRenderer } = await import("libpgs")
    if (!this.isActivationCurrent(seq)) return
    log("libpgs init with workerUrl:", `${base}/libpgs/libpgs.worker.js`)
    this.pgsRenderer = new PgsRenderer({
      canvas: this.overlayCanvas!,
      subUrl: url,
      workerUrl: `${base}/libpgs/libpgs.worker.js`,
    })
    if (this.timeOffset !== 0) {
      this.pgsRenderer.timeOffset = this.timeOffset
    }
    this.startSync()
  }

  private getOrCreateJassubCanvas(): HTMLCanvasElement {
    if (this.jassubCanvas) return this.jassubCanvas

    this.jassubCanvas = document.createElement("canvas")
    const dpr = devicePixelRatio || 1
    const w = (this.moviEl.clientWidth || 0) * dpr
    const h = (this.moviEl.clientHeight || 0) * dpr
    this.jassubCanvas.width = w
    this.jassubCanvas.height = h
    this.jassubCanvas.style.cssText = `
      position: absolute;
      top: 0; left: 0;
      width: 100%; height: 100%;
      pointer-events: none;
      opacity: 0;
    `
    const shadow = this.moviEl.shadowRoot
    if (shadow) {
      shadow.appendChild(this.jassubCanvas)
    }
    return this.jassubCanvas
  }

  private ensureOverlay(): void {
    if (this.overlayCanvas) return

    this.overlayCanvas = document.createElement("canvas")
    const dpr = devicePixelRatio || 1
    const w = (this.moviEl.clientWidth || 0) * dpr
    const h = (this.moviEl.clientHeight || 0) * dpr
    this.overlayCanvas.width = w
    this.overlayCanvas.height = h
    this.overlayCanvas.style.cssText = `
      position: absolute;
      top: 0; left: 0;
      width: 100%; height: 100%;
      pointer-events: none;
      z-index: 7;
    `
    this.displayCtx = this.overlayCanvas.getContext("2d")

    const shadow = this.moviEl.shadowRoot
    if (shadow) {
      const controls = shadow.querySelector(".movi-controls-container")
      if (controls) {
        shadow.insertBefore(this.overlayCanvas, controls)
      } else {
        shadow.appendChild(this.overlayCanvas)
      }
    } else {
      const wrapper = this.moviEl.parentElement!
      wrapper.style.position = "relative"
      wrapper.insertBefore(this.overlayCanvas, this.moviEl.nextSibling)
    }

    this.resizeObserver = new ResizeObserver(() => {
      const dpr = devicePixelRatio || 1
      const w = this.moviEl.clientWidth || 0
      const h = this.moviEl.clientHeight || 0
      if (this.overlayCanvas) {
        this.overlayCanvas.width = w * dpr
        this.overlayCanvas.height = h * dpr
      }
      if (this.jassubCanvas) {
        this.jassubCanvas.width = w * dpr
        this.jassubCanvas.height = h * dpr
      }
      log("resize overlay to", w * dpr, "x", h * dpr, "dpr", dpr)
    })
    this.resizeObserver.observe(this.moviEl)
  }

  private startCopyLoop(): void {
    if (this.copyFrameId != null) return
    const copy = () => {
      if (!this.jassubCanvas || !this.overlayCanvas || !this.displayCtx) return
      const srcW = this.jassubCanvas.width
      const srcH = this.jassubCanvas.height
      if (
        this.overlayCanvas.width !== srcW ||
        this.overlayCanvas.height !== srcH
      ) {
        this.overlayCanvas.width = srcW
        this.overlayCanvas.height = srcH
      }
      this.displayCtx.clearRect(0, 0, srcW, srcH)
      try {
        this.displayCtx.drawImage(this.jassubCanvas, 0, 0)
      } catch {
        /* canvas may be lost during navigation */
      }
      this.copyFrameId = requestAnimationFrame(copy)
    }
    this.copyFrameId = requestAnimationFrame(copy)
  }

  private stopCopyLoop(): void {
    if (this.copyFrameId != null) {
      cancelAnimationFrame(this.copyFrameId)
      this.copyFrameId = undefined
    }
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
    this.stopCopyLoop()
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
    if (this.jassubCanvas) {
      this.jassubCanvas.remove()
      this.jassubCanvas = null
    }
    if (this.overlayCanvas) {
      this.overlayCanvas.remove()
      this.overlayCanvas = null
    }
    this.displayCtx = null
    this.activeRenderer = "none"
  }
}
