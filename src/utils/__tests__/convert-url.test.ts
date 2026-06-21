import { describe, it, expect } from "vitest"
import { convertURL, safeBtoa } from "../str"

const base = {
  raw_url: "https://host/d/movie.mkv",
  name: "movie.mkv",
  d_url: "https://host/d/movie.mkv?sign=abc",
}

describe("convertURL — existing placeholders still work", () => {
  it("substitutes $durl (potplayer)", () => {
    expect(convertURL("potplayer://$durl", base)).toBe(
      "potplayer://https://host/d/movie.mkv?sign=abc",
    )
  })

  it("substitutes $edurl (encodeURIComponent)", () => {
    expect(convertURL("iina://weblink?url=$edurl", base)).toBe(
      "iina://weblink?url=" + encodeURIComponent(base.d_url),
    )
  })

  it("substitutes $bdurl (standard base64)", () => {
    expect(convertURL("x://$bdurl", base)).toBe(
      "x://" + window.btoa(base.d_url),
    )
  })

  it("substitutes $name", () => {
    expect(convertURL("p://$durl#$name", base)).toContain("#movie.mkv")
  })
})

describe("convertURL — mpv subfile (mpv-handler)", () => {
  const scheme = "mpv://play/$Bdurl/?subfile=$Bsub"

  it("emits URL-safe base64 video + subtitle when a subtitle is present", () => {
    const sub_url = "https://host/p/movie.srt"
    const out = convertURL(scheme, { ...base, sub_url })
    expect(out).toBe(
      `mpv://play/${safeBtoa(base.d_url)}/?subfile=${safeBtoa(sub_url)}`,
    )
  })

  it("strips the empty subfile parameter when no subtitle is present", () => {
    const out = convertURL(scheme, base)
    expect(out).toBe(`mpv://play/${safeBtoa(base.d_url)}/`)
    expect(out).not.toContain("subfile=")
  })
})
