import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  detectFormat,
  SubtitleManager,
  type SubtitleFile,
} from "../subtitle-manager"

const tick = () => new Promise((r) => setTimeout(r, 0))

describe("detectFormat", () => {
  it("returns ass for .ass files", () => {
    expect(detectFormat("movie.ass")).toBe("ass")
    expect(detectFormat("movie.ASS")).toBe("ass")
  })
  it("returns sup for .sup files", () => {
    expect(detectFormat("movie.sup")).toBe("sup")
    expect(detectFormat("movie.SUP")).toBe("sup")
  })
  it("returns srt for .srt files", () => {
    expect(detectFormat("movie.srt")).toBe("srt")
  })
  it("returns vtt for .vtt files", () => {
    expect(detectFormat("movie.vtt")).toBe("vtt")
  })
  it("returns vtt for unknown extensions", () => {
    expect(detectFormat("movie.xyz")).toBe("vtt")
  })
})

function createMockMoviElement() {
  const el = document.createElement("div") as any
  el._subtitleLangs = [] as Array<{
    lang: string
    label: string
    active: boolean
  }>
  el.currentTime = 0
  el.getSubtitleLangs = () => el._subtitleLangs
  el.getCanvas = () => {
    const c = document.createElement("canvas")
    c.width = 1920
    c.height = 1080
    return c
  }
  el.selectSubtitleLang = vi.fn()
  Object.defineProperty(el, "clientWidth", { value: 1920, writable: true })
  Object.defineProperty(el, "clientHeight", { value: 1080, writable: true })
  return el
}

describe("SubtitleManager", () => {
  let moviEl: ReturnType<typeof createMockMoviElement>
  let manager: SubtitleManager
  let wrapper: HTMLDivElement

  beforeEach(() => {
    wrapper = document.createElement("div")
    document.body.appendChild(wrapper)
    moviEl = createMockMoviElement()
    wrapper.appendChild(moviEl)
  })

  afterEach(async () => {
    await tick()
    manager?.destroy()
    wrapper?.remove()
  })

  describe("registerTracks", () => {
    it("populates subInfoMap from subtitle files", () => {
      manager = new SubtitleManager(moviEl)
      const files: SubtitleFile[] = [
        { name: "en.srt", url: "/subs/en.srt" },
        { name: "zh.ass", url: "/subs/zh.ass" },
        { name: "fr.sup", url: "/subs/fr.sup" },
      ]
      manager.registerTracks(files)
      expect(manager.getTrackCount()).toBe(3)
    })

    it("generates correct track HTML with data-format", () => {
      manager = new SubtitleManager(moviEl)
      manager.registerTracks([
        { name: "en.srt", url: "/subs/en.srt" },
        { name: "zh.ass", url: "/subs/zh.ass" },
      ])
      const html = manager.getTrackHTML()
      expect(html).toContain('data-format="srt"')
      expect(html).toContain('data-format="ass"')
      expect(html).toContain('kind="subtitles"')
      expect(html).toContain("en.srt")
      expect(html).toContain("zh.ass")
    })
  })

  describe("handleTrackChange", () => {
    it("does nothing when no track is active", () => {
      manager = new SubtitleManager(moviEl)
      manager.registerTracks([{ name: "en.srt", url: "/subs/en.srt" }])
      moviEl._subtitleLangs = [{ lang: "sub0", label: "en.srt", active: false }]
      manager.handleTrackChange()
      expect(manager.getActiveRenderer()).toBe("none")
    })

    it("activates nothing for SRT (native handles it)", () => {
      manager = new SubtitleManager(moviEl)
      manager.registerTracks([{ name: "en.srt", url: "/subs/en.srt" }])
      moviEl._subtitleLangs = [{ lang: "sub0", label: "en.srt", active: true }]
      manager.handleTrackChange()
      expect(manager.getActiveRenderer()).toBe("none")
    })

    it("returns 'ass' renderer type for ASS tracks", async () => {
      manager = new SubtitleManager(moviEl)
      manager.registerTracks([{ name: "zh.ass", url: "/subs/zh.ass" }])
      moviEl._subtitleLangs = [{ lang: "sub0", label: "zh.ass", active: true }]
      manager.handleTrackChange()
      await tick()
      expect(manager.getActiveRenderer()).toBe("ass")
    })

    it("returns 'sup' renderer type for SUP tracks", async () => {
      manager = new SubtitleManager(moviEl)
      manager.registerTracks([{ name: "fr.sup", url: "/subs/fr.sup" }])
      moviEl._subtitleLangs = [{ lang: "sub0", label: "fr.sup", active: true }]
      manager.handleTrackChange()
      await tick()
      expect(manager.getActiveRenderer()).toBe("sup")
    })

    it("destroys previous renderer when switching tracks", async () => {
      manager = new SubtitleManager(moviEl)
      manager.registerTracks([
        { name: "zh.ass", url: "/subs/zh.ass" },
        { name: "en.srt", url: "/subs/en.srt" },
      ])
      moviEl._subtitleLangs = [
        { lang: "sub0", label: "zh.ass", active: true },
        { lang: "sub1", label: "en.srt", active: false },
      ]
      manager.handleTrackChange()
      await tick()
      expect(manager.getActiveRenderer()).toBe("ass")

      moviEl._subtitleLangs = [
        { lang: "sub0", label: "zh.ass", active: false },
        { lang: "sub1", label: "en.srt", active: true },
      ]
      manager.handleTrackChange()
      await tick()
      expect(manager.getActiveRenderer()).toBe("none")
    })
  })

  describe("setTimeOffset", () => {
    it("stores offset value", () => {
      manager = new SubtitleManager(moviEl)
      manager.setTimeOffset(2.5)
      expect(manager.getTimeOffset()).toBe(2.5)
    })
  })

  describe("destroy", () => {
    it("cleans up all resources", () => {
      manager = new SubtitleManager(moviEl)
      manager.registerTracks([{ name: "zh.ass", url: "/subs/zh.ass" }])
      manager.destroy()
      expect(manager.getActiveRenderer()).toBe("none")
      expect(manager.getTrackCount()).toBe(0)
    })

    it("is idempotent (double destroy is safe)", () => {
      manager = new SubtitleManager(moviEl)
      manager.registerTracks([{ name: "zh.ass", url: "/subs/zh.ass" }])
      manager.destroy()
      manager.destroy()
      expect(manager.getActiveRenderer()).toBe("none")
    })
  })
})
