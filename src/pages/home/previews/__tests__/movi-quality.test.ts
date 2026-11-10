import { describe, it, expect, vi } from "vitest"
import {
  MOVI_115_OPEN_BUFFER_MB,
  buildMoviBufferAttribute,
  buildProviderSubFiles,
  buildQualityList,
  buildSourceHTML,
  moviBufferSizeForProvider,
  tierHeight,
  withHlsHint,
} from "../movi-quality"
import { SubtitleManager } from "../subtitle-manager"

describe("withHlsHint", () => {
  it("appends #.m3u8 so movi routes a proxied url through its HLS engine", () => {
    expect(withHlsHint("https://h/video_proxy/x?sign=a")).toBe(
      "https://h/video_proxy/x?sign=a#.m3u8",
    )
  })
  it("leaves an already-HLS url untouched (case-insensitive)", () => {
    expect(withHlsHint("https://h/p/index.m3u8")).toBe("https://h/p/index.m3u8")
    expect(withHlsHint("https://h/p/INDEX.M3U8")).toBe("https://h/p/INDEX.M3U8")
  })
})

describe("buildQualityList", () => {
  const orig = "https://h/d/movie.mkv?sign=o"

  it("non-115 provider yields only the original (no selector shown)", () => {
    expect(buildQualityList(orig, "Local", undefined)).toEqual([
      { label: "原画", url: orig, height: 0 },
    ])
    expect(buildQualityList(orig, "Aliyundrive", [])).toEqual([
      { label: "原画", url: orig, height: 0 },
    ])
  })

  it("115 with tiers: original first, then transcoded tiers (hls-hinted)", () => {
    const list = buildQualityList(orig, "115 Open", [
      { resolution: "1080P", definition: 4, url: "https://h/video_proxy/a" },
      { resolution: "", definition: 5, url: "https://h/video_proxy/b" },
    ])
    expect(list).toEqual([
      // no media info here: the original takes the highest tier's height
      { label: "原画", url: orig, height: 2160 },
      { label: "1080P", url: "https://h/video_proxy/a#.m3u8", height: 1080 },
      { label: "4K", url: "https://h/video_proxy/b#.m3u8", height: 2160 }, // definition fallback
    ])
  })

  it("115 with no usable sources falls back to original-only", () => {
    expect(buildQualityList(orig, "115 Open", [])).toEqual([
      { label: "原画", url: orig, height: 0 },
    ])
    expect(
      buildQualityList(orig, "115 Open", [
        { resolution: "x", definition: 9, url: "" },
      ]),
    ).toEqual([{ label: "原画", url: orig, height: 0 }])
  })

  it("unknown definition with empty resolution → '<n>P'", () => {
    const list = buildQualityList(orig, "115 Open", [
      { resolution: "", definition: 9, url: "https://h/video_proxy/c" },
    ])
    expect(list[1].label).toBe("9P")
  })

  it("undefined provider → original-only (the catch-fallback path)", () => {
    expect(buildQualityList(orig, undefined, undefined)).toEqual([
      { label: "原画", url: orig, height: 0 },
    ])
  })
})

describe("115 original-stream movi buffer", () => {
  it("uses a larger movi HTTP buffer only for 115 Open", () => {
    expect(moviBufferSizeForProvider("115 Open")).toBe(MOVI_115_OPEN_BUFFER_MB)
    expect(buildMoviBufferAttribute("115 Open")).toBe(
      ` buffersize="${MOVI_115_OPEN_BUFFER_MB}"`,
    )
  })

  it("keeps movi defaults for non-115 providers", () => {
    expect(moviBufferSizeForProvider("Local")).toBe(0)
    expect(moviBufferSizeForProvider(undefined)).toBe(0)
    expect(buildMoviBufferAttribute("Local")).toBe("")
    expect(buildMoviBufferAttribute(undefined)).toBe("")
  })
})

describe("tierHeight", () => {
  it("reads the label first, then 4K, then the definition number", () => {
    expect(tierHeight("1080P", 0)).toBe(1080)
    expect(tierHeight("720p", 0)).toBe(720)
    expect(tierHeight("4K", 0)).toBe(2160)
    expect(tierHeight("", 3)).toBe(720)
    expect(tierHeight("", 99)).toBe(0)
  })
})

describe("buildSourceHTML (movi owns the source menu)", () => {
  const orig = "https://h/d/movie.mkv?sign=o"
  const list = buildQualityList(orig, "115 Open", [
    { resolution: "1080P", definition: 4, url: "https://h/video_proxy/a" },
    { resolution: "720P", definition: 3, url: "https://h/video_proxy/b" },
  ])

  const sources = () => {
    const host = document.createElement("div")
    host.innerHTML = buildSourceHTML(list)
    return Array.from(host.querySelectorAll("source"))
  }

  it("lists the original first and marks it as the default", () => {
    const [first, ...rest] = sources()
    expect(first.getAttribute("src")).toBe(orig)
    expect(first.getAttribute("data-label")).toBe("原画")
    expect(first.getAttribute("data-height")).toBe("1080")
    expect(first.hasAttribute("data-default")).toBe(true)
    expect(rest.some((s) => s.hasAttribute("data-default"))).toBe(false)
  })

  it("follows with the 115 tiers, HLS-hinted, with label and height", () => {
    const [, a, b] = sources()
    expect(a.getAttribute("src")).toBe("https://h/video_proxy/a#.m3u8")
    expect(a.getAttribute("data-label")).toBe("1080P")
    expect(a.getAttribute("data-height")).toBe("1080")
    expect(b.getAttribute("src")).toBe("https://h/video_proxy/b#.m3u8")
    expect(b.getAttribute("data-height")).toBe("720")
  })

  it("escapes attribute values", () => {
    const host = document.createElement("div")
    host.innerHTML = buildSourceHTML([
      { label: 'a"b', url: 'https://h/x?a=1&b="2"', height: 1 },
      { label: "t", url: "https://h/y", height: 1 },
    ])
    const first = host.querySelector("source")!
    expect(first.getAttribute("src")).toBe('https://h/x?a=1&b="2"')
    expect(first.getAttribute("data-label")).toBe('a"b')
  })

  it("is empty for a single source, which stays a plain src", () => {
    expect(buildSourceHTML(buildQualityList(orig, "Local", undefined))).toBe("")
  })
})

describe("provider subtitles declared as <track> (movi owns the subtitle menu)", () => {
  // 115's answer for a file with embedded tracks plus a sidecar file.
  const subs = [
    {
      language: "chi",
      title: "[内置字幕]简体中文",
      url: "https://h/video_proxy/s0",
      type: "srt",
      embedded_title: "简体中文",
      embedded_order: 0,
    },
    {
      language: "eng",
      title: "[内置字幕]英语",
      url: "https://h/video_proxy/s1",
      type: "srt",
      embedded_title: "英语",
      embedded_order: 1,
    },
    { language: "", title: "movie.zh.srt", url: "https://h/s2", type: "srt" },
  ]

  const tracks = () => {
    const mgr = new SubtitleManager(null as any)
    mgr.registerTracks(buildProviderSubFiles(subs))
    const host = document.createElement("div")
    host.innerHTML = mgr.getTrackHTML()
    mgr.destroy()
    return Array.from(host.querySelectorAll("track"))
  }

  it("carries the in-band identity of an extracted container track", () => {
    const [a, b] = tracks()
    expect(a.getAttribute("data-inband-title")).toBe("简体中文")
    expect(a.getAttribute("data-inband-order")).toBe("0")
    expect(b.getAttribute("data-inband-title")).toBe("英语")
    expect(b.getAttribute("data-inband-order")).toBe("1")
  })

  it("leaves a sidecar file as a plain external track", () => {
    const c = tracks()[2]
    expect(c.hasAttribute("data-inband-title")).toBe(false)
    expect(c.hasAttribute("data-inband-order")).toBe(false)
  })

  it("keeps order 0 (a falsy but valid index)", () => {
    const files = buildProviderSubFiles(subs)
    expect(files[0]).toMatchObject({ inbandTitle: "简体中文", inbandOrder: 0 })
    expect(files[2]).not.toHaveProperty("inbandOrder")
  })

  it("gives every track its own srclang, so none replaces another", () => {
    const langs = tracks().map((t) => t.getAttribute("srclang"))
    expect(new Set(langs).size).toBe(3)
  })

  it("hands SRT to movi as vtt without fetching or converting it", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch")
    const t = tracks()[0]
    expect(t.getAttribute("data-format")).toBe("vtt")
    expect(t.getAttribute("src")).toBe("https://h/video_proxy/s0")
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})

describe("buildProviderSubFiles (cross-source provider subtitles)", () => {
  it("names tracks with the format extension so detectFormat picks the renderer", () => {
    expect(
      buildProviderSubFiles([
        {
          language: "chi",
          title: "简体",
          url: "https://h/video_proxy/a",
          type: "ass",
        },
      ]),
    ).toEqual([{ name: "简体.ass", url: "https://h/video_proxy/a" }])
  })
  it("falls back title->language->index, and lowercases the type", () => {
    expect(
      buildProviderSubFiles([
        { language: "eng", title: "", url: "https://h/b", type: "SRT" },
        { language: "", title: "", url: "https://h/c", type: "" },
      ]),
    ).toEqual([
      { name: "eng.srt", url: "https://h/b" },
      { name: "字幕2.srt", url: "https://h/c" },
    ])
  })
  it("drops url-less entries and tolerates undefined", () => {
    expect(
      buildProviderSubFiles([
        { language: "x", title: "x", url: "", type: "srt" },
      ]),
    ).toEqual([])
    expect(buildProviderSubFiles(undefined)).toEqual([])
  })
})

describe("buildProviderSubFiles (tracks OpenList extracts itself)", () => {
  const subs = [
    // no name in the container: only order and language say which track it is
    {
      language: "kor",
      title: "",
      url: "https://h/api/fs/subtitle_extract?track=10",
      type: "srt",
      source: "extracted",
      embedded_title: "",
      embedded_order: 10,
    },
  ]

  it("carries order and language when the title is empty", () => {
    const [f] = buildProviderSubFiles(subs)
    expect(f).toMatchObject({
      name: "kor.srt",
      inbandOrder: 10,
      inbandLang: "kor",
      extracted: true,
    })
    expect(f.inbandTitle).toBeUndefined()
  })

  it("declares it on the <track> without a title", () => {
    const mgr = new SubtitleManager(null as any)
    mgr.registerTracks(buildProviderSubFiles(subs))
    const host = document.createElement("div")
    host.innerHTML = mgr.getTrackHTML()
    mgr.destroy()
    const t = host.querySelector("track")!
    expect(t.hasAttribute("data-inband-title")).toBe(false)
    expect(t.getAttribute("data-inband-order")).toBe("10")
    expect(t.getAttribute("data-inband-lang")).toBe("kor")
  })
})
