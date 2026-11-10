import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  detectFormat,
  extractedUrl,
  isPartialExtract,
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

describe("extracted subtitles (read out of the video by OpenList)", () => {
  const api = "https://h/api/fs/subtitle_extract?path=%2Fa.mkv&track=2&sign=s"
  const file: SubtitleFile = {
    name: "kor.srt",
    url: api,
    inbandOrder: 2,
    inbandLang: "kor",
    extracted: true,
  }
  let wrapper: HTMLDivElement
  let moviEl: ReturnType<typeof createMockMoviElement>
  let manager: SubtitleManager

  beforeEach(() => {
    // only the timers: the body of a Response is read with the real scheduler
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] })
    wrapper = document.createElement("div")
    document.body.appendChild(wrapper)
    moviEl = createMockMoviElement()
    wrapper.appendChild(moviEl)
    manager = new SubtitleManager(null)
    manager.registerTracks([file])
    moviEl.innerHTML = manager.getTrackHTML()
    manager.attach(moviEl)
    let n = 0
    URL.createObjectURL = vi.fn(() => `blob:extract-${++n}`)
    URL.revokeObjectURL = vi.fn()
  })

  afterEach(() => {
    manager.destroy()
    wrapper.remove()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  const response = (state: string) =>
    new Response("1\n00:00:01,000 --> 00:00:02,000\nhi\n", {
      headers: { "X-OpenList-Extract": state },
    })

  it("declares the identity of a track that has no title", () => {
    const t = moviEl.querySelector("track")!
    expect(t.hasAttribute("data-inband-title")).toBe(false)
    expect(t.getAttribute("data-inband-order")).toBe("2")
    expect(t.getAttribute("data-inband-lang")).toBe("kor")
  })

  it("reads from the playback position and again every 5 s until it is whole", async () => {
    const fetched: string[] = []
    const answers = [
      response("partial; done=0.10"),
      response("partial; done=0.60"),
      response("complete"),
    ]
    vi.stubGlobal("fetch", async (u: string) => {
      fetched.push(u)
      return answers.shift()!
    })
    moviEl.currentTime = 42.7
    moviEl._subtitleLangs = [{ lang: "sub0", label: "kor", active: true }]
    manager.handleTrackChange()

    const track = moviEl.querySelector("track")!
    await vi.waitFor(() =>
      expect(track.getAttribute("src")).toBe("blob:extract-1"),
    )
    expect(fetched).toEqual([`${api}&at=42`])

    moviEl.currentTime = 50
    await vi.advanceTimersByTimeAsync(4900)
    expect(fetched).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(100)
    await vi.waitFor(() =>
      expect(track.getAttribute("src")).toBe("blob:extract-2"),
    )
    expect(fetched[1]).toBe(`${api}&at=50&rev=1`)

    await vi.advanceTimersByTimeAsync(5000)
    await vi.waitFor(() =>
      expect(track.getAttribute("src")).toBe("blob:extract-3"),
    )
    expect(fetched).toHaveLength(3)

    // whole: nothing more is asked
    await vi.advanceTimersByTimeAsync(60_000)
    expect(fetched).toHaveLength(3)
  })

  it("stops asking when another subtitle is picked", async () => {
    const fetched: string[] = []
    vi.stubGlobal("fetch", async (u: string) => {
      fetched.push(u)
      return response("partial; done=0.10")
    })
    moviEl._subtitleLangs = [{ lang: "sub0", label: "kor", active: true }]
    manager.handleTrackChange()
    await vi.waitFor(() =>
      expect(moviEl.querySelector("track")!.getAttribute("src")).toBe(
        "blob:extract-1",
      ),
    )
    expect(fetched).toHaveLength(1)

    moviEl._subtitleLangs = []
    manager.handleTrackChange()
    await vi.advanceTimersByTimeAsync(30_000)
    expect(fetched).toHaveLength(1)
  })

  it("leaves a track that is not extracted to the player", async () => {
    manager.registerTracks([{ name: "a.srt", url: "https://h/p/a.srt" }])
    const spy = vi.fn()
    vi.stubGlobal("fetch", spy)
    moviEl._subtitleLangs = [{ lang: "sub0", label: "a", active: true }]
    manager.handleTrackChange()
    await vi.advanceTimersByTimeAsync(10_000)
    expect(spy).not.toHaveBeenCalled()
  })

  it("does not read an extracted ASS track while preparing the others", async () => {
    manager.registerTracks([{ ...file, name: "kor.ass" }])
    const spy = vi.fn()
    vi.stubGlobal("fetch", spy)
    await manager.convertAssTracks()
    expect(spy).not.toHaveBeenCalled()
  })
})

describe("extractedUrl and isPartialExtract", () => {
  it("adds the position, and a revision from the second fetch on", () => {
    expect(extractedUrl("https://h/x?a=1", 12.9, 0)).toBe(
      "https://h/x?a=1&at=12",
    )
    expect(extractedUrl("https://h/x", 0, 3)).toBe("https://h/x?at=0&rev=3")
    expect(extractedUrl("https://h/x", -4, 0)).toBe("https://h/x?at=0")
  })
  it("reads the header", () => {
    expect(isPartialExtract("partial; done=0.42")).toBe(true)
    expect(isPartialExtract("complete")).toBe(false)
    expect(isPartialExtract(null)).toBe(false)
  })
})
