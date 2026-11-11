import type { PgsRenderer } from "libpgs"

export type SubtitleFormat = "ass" | "sup" | "srt" | "vtt"
// ASS/SSA is not in this list: movi draws it itself (see setJassubHost in
// movi_core.tsx). What is left here is what movi cannot draw, external PGS.
export type ActiveRenderer = "sup" | "none"

export interface SubtitleFile {
  name: string
  url: string
  /** The in-band track of the original file this file is the extracted twin
   *  of (its title and its index among the container's subtitle streams). */
  inbandTitle?: string
  inbandOrder?: number
  inbandLang?: string
  /** A track OpenList reads out of the video as it is asked for: it may be
   *  partial, and is fetched again from the playback position. */
  extracted?: boolean
}

interface SubtitleInfo {
  lang: string
  label: string
  url: string
  format: SubtitleFormat
  inbandTitle?: string
  inbandOrder?: number
  inbandLang?: string
  extracted?: boolean
}

// What /api/fs/subtitle_extract says about how far a track has got: "partial;
// done=0.42" while it is being read, "complete" once it is whole.
export const EXTRACT_HEADER = "X-OpenList-Extract"
const EXTRACT_REFRESH_MS = 5000

export const isPartialExtract = (header: string | null): boolean =>
  !!header && /^\s*partial\b/i.test(header)

// The extraction URL for the position the viewer is at (reading starts there),
// and for the nth fetch of it, so that every one is a new URL for the track.
export const extractedUrl = (
  url: string,
  seconds: number,
  rev: number,
): string =>
  `${url}${url.includes("?") ? "&" : "?"}at=${Math.max(0, Math.floor(seconds))}${rev > 0 ? `&rev=${rev}` : ""}`

const isDev = import.meta.env?.DEV ?? false

function log(...args: unknown[]) {
  if (isDev) console.log("[SubtitleManager]", ...args)
}

const escapeAttr = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;")

// `data-inband-*`: movi's way of saying "this file is the same subtitle as that
// track of the original" (see movi-player's SourceSelection.ts).
// A track the container gave no name has no title; the order and the language
// then say which it is.
const trackAlias = (info: SubtitleInfo) =>
  typeof info.inbandOrder === "number"
    ? `${info.inbandTitle ? ` data-inband-title="${escapeAttr(info.inbandTitle)}"` : ""} data-inband-order="${info.inbandOrder}"${info.inbandLang ? ` data-inband-lang="${escapeAttr(info.inbandLang)}"` : ""}`
    : ""

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
  private moviEl: HTMLElement | null
  private subInfoMap = new Map<string, SubtitleInfo>()
  private activeRenderer: ActiveRenderer = "none"
  private pgsRenderer: PgsRenderer | null = null
  private syncTimer: number | undefined
  private overlayCanvas: HTMLCanvasElement | null = null
  private resizeObserver: ResizeObserver | null = null
  private timeOffset = 0
  private destroyed = false
  private lastActiveLang: string | null = null
  private pollTimer: number | undefined
  private fullscreenChangeHandler: (() => void) | null = null
  private activationSeq = 0
  private lastPlayingHls = false
  private followWake: (() => void) | null = null
  private followTimer: number | undefined

  private blobUrls: string[] = []

  constructor(moviEl: HTMLElement | null) {
    this.moviEl = moviEl
    if (moviEl) this.setupFullscreenWatch()
  }

  /** Hand over the <movi-player> once it exists: the tracks are declared (and
   *  their markup built) before the element is, the PGS overlay needs it. */
  attach(moviEl: HTMLElement): void {
    if (this.moviEl) return
    this.moviEl = moviEl
    this.setupFullscreenWatch()
  }

  private setupFullscreenWatch(): void {
    this.fullscreenChangeHandler = () => {
      if (!this.overlayCanvas || !this.moviEl) return
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
        // movi reads SRT itself (its parser takes the comma timestamps), so an
        // .srt goes through as "vtt": the format hint that gives it the same
        // caption styling the converted file always had.
        format: ((f) => (f === "srt" ? "vtt" : f))(detectFormat(file.name)),
        inbandTitle: file.inbandTitle,
        inbandOrder: file.inbandOrder,
        inbandLang: file.inbandLang,
        extracted: file.extracted,
      })
    })
  }

  // movi hands external ASS to libass as text it read with fetch().text(), which
  // is UTF-8: a UTF-16 .ass (many fansub files, e.g. popgo) comes out as garbage
  // and nothing renders, on every source. Detect a UTF-16 BOM, transcode to a
  // UTF-8 blob, and repoint the track url (the <track> src) at it. UTF-8 (with or
  // without BOM) is left untouched. Call before getTrackHTML.
  async convertAssTracks(): Promise<void> {
    const tasks: Promise<void>[] = []
    for (const [, info] of this.subInfoMap) {
      // An extracted track is made by OpenList: UTF-8, and not one to read
      // before anybody asked for it.
      if (info.format !== "ass" || info.extracted) continue
      tasks.push(
        fetch(info.url)
          .then((r) => r.arrayBuffer())
          .then((buf) => {
            // the manager went with its player while this was being read: a
            // copy made now would never be revoked
            if (this.destroyed) return
            const text = utf16ToUtf8IfNeeded(buf)
            if (text === null) return // already UTF-8 (or BOM-less) — leave as-is
            const blob = new Blob([text], { type: "text/plain" })
            info.url = URL.createObjectURL(blob)
            this.blobUrls.push(info.url)
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
          `<track kind="subtitles" src="${escapeAttr(info.url)}" srclang="${info.lang}" label="${escapeAttr(info.label)}" data-format="${info.format}"${trackAlias(info)}>`,
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
    this.stopFollowing()

    const langs = (this.moviEl as any)?.getSubtitleLangs?.() as
      Array<{ lang: string; label: string; active: boolean }> | undefined
    const active = langs?.find((t) => t.active)

    this.destroyRenderers()

    if (!active) return

    const info = this.subInfoMap.get(active.lang)
    if (!info) return

    if (info.extracted) {
      // The original shows the track from its own container; reading it out of
      // the file as well would be a second reader of a file the storage lets
      // one connection at a time read. Only a source that dropped the track
      // (a transcode) needs the extracted file.
      if (!this.playingHls()) return
      if (info.format === "sup") this.activeRenderer = "sup"
      void this.followExtraction(info, activationSeq)
      return
    }

    if (info.format === "sup") {
      this.activeRenderer = "sup"
      log("activating SUP renderer for", info.label)
      void this.activateSUP(info.url, activationSeq).catch((e) => {
        if (!this.isActivationCurrent(activationSeq)) return
        log("SUP renderer activation failed", e)
        this.destroyRenderers()
      })
    }
  }

  // True while the source in play is an HLS stream, which carries no subtitle
  // tracks of the original file (movi's own test for an adaptive source).
  private playingHls(): boolean {
    const src = (this.moviEl as any)?.currentSrc
    return typeof src === "string" && /\.m3u8/i.test(src)
  }

  // The track showing is made by OpenList and may still be being read: fetch it
  // from where the viewer is, hand what there is to the player, and again every
  // few seconds until the response says it is whole. The player is given the
  // fetched text (a blob URL set as the <track> src, which movi loads again as
  // HTML does) so that this is the only request for it.
  private async followExtraction(
    info: SubtitleInfo,
    seq: number,
  ): Promise<void> {
    for (let rev = 0; this.isActivationCurrent(seq); rev++) {
      const at = Number((this.moviEl as any)?.currentTime) || 0
      let partial = false
      try {
        const res = await fetch(extractedUrl(info.url, at, rev))
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        partial = isPartialExtract(res.headers.get(EXTRACT_HEADER))
        const bytes = await res.arrayBuffer()
        if (!this.isActivationCurrent(seq)) return
        await this.deliverExtracted(info, bytes, seq)
      } catch (e) {
        log("extracted subtitle fetch failed for", info.label, e)
        partial = rev < 3 // a few more tries, then leave the track as it is
      }
      if (!partial) return
      await new Promise<void>((resolve) => {
        this.followWake = resolve
        this.followTimer = window.setTimeout(resolve, EXTRACT_REFRESH_MS)
      })
    }
  }

  private async deliverExtracted(
    info: SubtitleInfo,
    bytes: ArrayBuffer,
    seq: number,
  ): Promise<void> {
    if (info.format === "sup") {
      // libpgs takes the bytes itself (loadFromBuffer replaces what the renderer
      // holds and re-renders), so the renderer stays and nothing is fetched.
      this.activeRenderer = "sup"
      if (this.pgsRenderer) this.pgsRenderer.loadFromBuffer(bytes)
      else await this.activateSUP(bytes, seq)
      return
    }
    const url = URL.createObjectURL(new Blob([bytes]))
    this.blobUrls.push(url)
    this.moviEl
      ?.querySelector(`track[srclang="${info.lang}"]`)
      ?.setAttribute("src", url)
  }

  private stopFollowing(): void {
    if (this.followTimer) clearTimeout(this.followTimer)
    this.followTimer = undefined
    this.followWake?.()
    this.followWake = null
  }

  /** The player's subtitle delay (mpv's sub-delay: positive shows them later),
   *  applied by startSync. */
  setTimeOffset(seconds: number): void {
    this.timeOffset = seconds
  }

  startPolling(): void {
    if (this.pollTimer) return
    log("startPolling for subtitle track changes")
    this.pollTimer = window.setInterval(() => {
      if (this.destroyed) return
      const langs = (this.moviEl as any)?.getSubtitleLangs?.() as
        Array<{ lang: string; label: string; active: boolean }> | undefined
      const active = langs?.find((t) => t.active)
      const activeLang = active?.lang ?? null
      const hls = this.playingHls()
      if (activeLang !== this.lastActiveLang || hls !== this.lastPlayingHls) {
        log("detected track change:", this.lastActiveLang, "→", activeLang)
        this.lastActiveLang = activeLang
        this.lastPlayingHls = hls
        this.handleTrackChange()
      }
    }, 500)
  }

  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    log("destroy")
    this.stopFollowing()
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
    for (const u of this.blobUrls) URL.revokeObjectURL(u)
    this.blobUrls = []
  }

  private isActivationCurrent(seq: number): boolean {
    return !this.destroyed && this.activationSeq === seq
  }

  private async activateSUP(
    source: string | ArrayBuffer,
    seq: number,
  ): Promise<void> {
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
      ...(typeof source === "string" ? { subUrl: source } : {}),
      workerUrl: `${base}/libpgs/libpgs.worker.js`,
    })
    if (typeof source !== "string") this.pgsRenderer.loadFromBuffer(source)
    this.startSync()
  }

  private ensureOverlay(): void {
    if (this.overlayCanvas || !this.moviEl) return
    const moviEl = this.moviEl

    this.overlayCanvas = document.createElement("canvas")
    const dpr = devicePixelRatio || 1
    const w = (moviEl.clientWidth || 0) * dpr
    const h = (moviEl.clientHeight || 0) * dpr
    this.overlayCanvas.width = w
    this.overlayCanvas.height = h
    this.overlayCanvas.style.cssText = `
      position: absolute;
      top: 0; left: 0;
      width: 100%; height: 100%;
      pointer-events: none;
      z-index: 7;
    `

    const shadow = moviEl.shadowRoot
    if (shadow) {
      const controls = shadow.querySelector(".movi-controls-container")
      if (controls) {
        shadow.insertBefore(this.overlayCanvas, controls)
      } else {
        shadow.appendChild(this.overlayCanvas)
      }
    } else {
      const wrapper = moviEl.parentElement!
      wrapper.style.position = "relative"
      wrapper.insertBefore(this.overlayCanvas, moviEl.nextSibling)
    }

    this.resizeObserver = new ResizeObserver(() => {
      const dpr = devicePixelRatio || 1
      const w = moviEl.clientWidth || 0
      const h = moviEl.clientHeight || 0
      if (this.overlayCanvas) {
        this.overlayCanvas.width = w * dpr
        this.overlayCanvas.height = h * dpr
      }
      log("resize overlay to", w * dpr, "x", h * dpr, "dpr", dpr)
    })
    this.resizeObserver.observe(moviEl)
  }

  private startSync(): void {
    if (this.syncTimer) clearInterval(this.syncTimer)
    this.syncTimer = window.setInterval(() => {
      const time = (this.moviEl as any)?.currentTime
      if (typeof time !== "number") return

      // libpgs's own timeOffset only applies to a <video> it watches, and it
      // watches none: the delay is applied to the time it is given.
      if (this.pgsRenderer) {
        this.pgsRenderer.renderAtTimestamp(time - this.timeOffset)
      }
    }, 50)
  }

  private destroyRenderers(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer)
      this.syncTimer = undefined
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
