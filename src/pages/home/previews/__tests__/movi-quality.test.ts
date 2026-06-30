import { describe, it, expect } from "vitest"
import {
  MOVI_115_OPEN_BUFFER_MB,
  buildMoviBufferAttribute,
  buildProviderSubFiles,
  buildQualityList,
  moviBufferSizeForProvider,
  qualitySwitchPlan,
  withHlsHint,
} from "../movi-quality"

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
      { label: "原画", url: orig },
    ])
    expect(buildQualityList(orig, "Aliyundrive", [])).toEqual([
      { label: "原画", url: orig },
    ])
  })

  it("115 with tiers: original first, then transcoded tiers (hls-hinted)", () => {
    const list = buildQualityList(orig, "115 Open", [
      { resolution: "1080P", definition: 4, url: "https://h/video_proxy/a" },
      { resolution: "", definition: 5, url: "https://h/video_proxy/b" },
    ])
    expect(list).toEqual([
      { label: "原画", url: orig },
      { label: "1080P", url: "https://h/video_proxy/a#.m3u8" },
      { label: "4K", url: "https://h/video_proxy/b#.m3u8" }, // definition fallback
    ])
  })

  it("115 with no usable sources falls back to original-only", () => {
    expect(buildQualityList(orig, "115 Open", [])).toEqual([
      { label: "原画", url: orig },
    ])
    expect(
      buildQualityList(orig, "115 Open", [
        { resolution: "x", definition: 9, url: "" },
      ]),
    ).toEqual([{ label: "原画", url: orig }])
  })

  it("unknown definition with empty resolution → '<n>P'", () => {
    const list = buildQualityList(orig, "115 Open", [
      { resolution: "", definition: 9, url: "https://h/video_proxy/c" },
    ])
    expect(list[1].label).toBe("9P")
  })

  it("undefined provider → original-only (the catch-fallback path)", () => {
    expect(buildQualityList(orig, undefined, undefined)).toEqual([
      { label: "原画", url: orig },
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

describe("qualitySwitchPlan (regression: keep subtitles on quality switch)", () => {
  it("reuses the live element via in-place swap instead of rebuilding", () => {
    // The whole point of the fix: a live player must be re-sourced in place so
    // its <track>/SubtitleManager survive and the original subs re-apply.
    expect(qualitySwitchPlan(true)).toBe("swap")
  })
  it("builds a fresh element only when none exists yet", () => {
    expect(qualitySwitchPlan(false)).toBe("build")
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
