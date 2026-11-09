import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  detectFormat,
  SubtitleManager,
  type SubtitleFile,
} from "../subtitle-manager"

const readBlob = (b: Blob) =>
  new Promise<string>((res) => {
    const fr = new FileReader()
    fr.onload = () => res(String(fr.result))
    fr.readAsText(b)
  })

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
      // movi reads SRT itself; the hint that styles it is "vtt"
      expect(html).toContain('data-format="vtt"')
      expect(html).toContain('data-format="ass"')
      expect(html).toContain('kind="subtitles"')
      expect(html).toContain("en.srt")
      expect(html).toContain("zh.ass")
    })
  })

  describe("external ASS is declared for movi", () => {
    const utf16le = (s: string) => {
      const out = [0xff, 0xfe]
      for (const ch of s) {
        const c = ch.charCodeAt(0)
        out.push(c & 0xff, (c >> 8) & 0xff)
      }
      return new Uint8Array(out).buffer
    }
    const tracks = (m: SubtitleManager) => {
      const host = document.createElement("div")
      host.innerHTML = m.getTrackHTML()
      return Array.from(host.querySelectorAll("track"))
    }

    afterEach(() => vi.unstubAllGlobals())

    it("a UTF-8 .ass keeps its url and is marked data-format=ass", async () => {
      const f = vi.fn(async () => ({
        arrayBuffer: async () =>
          new TextEncoder().encode("[Script Info]").buffer,
      }))
      vi.stubGlobal("fetch", f)
      manager = new SubtitleManager(null)
      manager.registerTracks([{ name: "zh.ass", url: "/subs/zh.ass" }])
      await manager.convertAssTracks()
      const [t] = tracks(manager)
      expect(t.getAttribute("src")).toBe("/subs/zh.ass")
      expect(t.getAttribute("data-format")).toBe("ass")
    })

    it("a UTF-16 .ass becomes a UTF-8 blob url in the <track> src", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => ({
          arrayBuffer: async () => utf16le("[Script Info]\n魔法少女"),
        })),
      )
      const created: Blob[] = []
      URL.createObjectURL = vi.fn((b: Blob) => {
        created.push(b)
        return "blob:ass-1"
      })
      URL.revokeObjectURL = vi.fn()
      manager = new SubtitleManager(null)
      manager.registerTracks([{ name: "zh.ass", url: "/subs/zh.ass" }])
      await manager.convertAssTracks()
      const [t] = tracks(manager)
      expect(t.getAttribute("src")).toBe("blob:ass-1")
      expect(t.getAttribute("data-format")).toBe("ass")
      expect(await readBlob(created[0])).toBe("[Script Info]\n魔法少女")
      manager.destroy()
      expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:ass-1")
    })

    it("only .ass files are fetched; srt/vtt/sup go through untouched", async () => {
      const f = vi.fn()
      vi.stubGlobal("fetch", f)
      manager = new SubtitleManager(null)
      manager.registerTracks([
        { name: "a.srt", url: "/a.srt" },
        { name: "b.vtt", url: "/b.vtt" },
        { name: "c.sup", url: "/c.sup" },
      ])
      await manager.convertAssTracks()
      expect(f).not.toHaveBeenCalled()
      expect(tracks(manager).map((t) => t.getAttribute("data-format"))).toEqual(
        ["vtt", "vtt", "sup"],
      )
    })

    it("keeps data-inband-* on an ASS track", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => ({ arrayBuffer: async () => new ArrayBuffer(0) })),
      )
      manager = new SubtitleManager(null)
      manager.registerTracks([
        { name: "x.ass", url: "/x", inbandTitle: "简体", inbandOrder: 2 },
      ])
      await manager.convertAssTracks()
      const [t] = tracks(manager)
      expect(t.getAttribute("data-inband-title")).toBe("简体")
      expect(t.getAttribute("data-inband-order")).toBe("2")
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

    it("leaves ASS to movi: no renderer, no overlay canvas", async () => {
      manager = new SubtitleManager(moviEl)
      manager.registerTracks([{ name: "zh.ass", url: "/subs/zh.ass" }])
      moviEl._subtitleLangs = [{ lang: "sub0", label: "zh.ass", active: true }]
      manager.handleTrackChange()
      await tick()
      expect(manager.getActiveRenderer()).toBe("none")
      expect(wrapper.querySelector("canvas")).toBeNull()
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
        { name: "zh.sup", url: "/subs/zh.sup" },
        { name: "en.srt", url: "/subs/en.srt" },
      ])
      moviEl._subtitleLangs = [
        { lang: "sub0", label: "zh.sup", active: true },
        { lang: "sub1", label: "en.srt", active: false },
      ]
      manager.handleTrackChange()
      await tick()
      expect(manager.getActiveRenderer()).toBe("sup")

      moviEl._subtitleLangs = [
        { lang: "sub0", label: "zh.sup", active: false },
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
