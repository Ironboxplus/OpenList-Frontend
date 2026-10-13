import { describe, expect, it } from "vitest"
import { mpvCommand } from "../mpv-command"

const base = "http://h:5244/d"
const enc = (name: string) =>
  `${base}/${encodeURIComponent(name)}?sign=abc=:0`.replace(/!/g, "%21")

describe("mpvCommand", () => {
  it("is exactly mpv + quoted url for one file without subtitles", () => {
    expect(mpvCommand([{ url: `${base}/a.mkv?sign=x`, subUrls: [] }])).toBe(
      `mpv "${base}/a.mkv?sign=x"`,
    )
  })

  it("appends --sub-file for each subtitle of a single file", () => {
    expect(
      mpvCommand([
        { url: `${base}/a.mkv`, subUrls: [`${base}/a.srt`, `${base}/a.ass`] },
      ]),
    ).toBe(
      `mpv "${base}/a.mkv" --sub-file="${base}/a.srt" --sub-file="${base}/a.ass"`,
    )
  })

  it("groups only the files that have subtitles in a playlist", () => {
    expect(
      mpvCommand([
        { url: `${base}/1.mkv`, subUrls: [`${base}/1.srt`] },
        { url: `${base}/2.mkv`, subUrls: [] },
        {
          url: `${base}/3.mkv`,
          subUrls: [`${base}/3.a.srt`, `${base}/3.b.srt`],
        },
      ]),
    ).toBe(
      `mpv "--{" "${base}/1.mkv" --sub-file="${base}/1.srt" "--}" "${base}/2.mkv"` +
        ` "--{" "${base}/3.mkv" --sub-file="${base}/3.a.srt" --sub-file="${base}/3.b.srt" "--}"`,
    )
  })

  it("leaves a multi-file command without subtitles as a plain list", () => {
    expect(
      mpvCommand([
        { url: `${base}/1.mkv`, subUrls: [] },
        { url: `${base}/2.mkv`, subUrls: [] },
      ]),
    ).toBe(`mpv "${base}/1.mkv" "${base}/2.mkv"`)
  })

  it("never leaves a shell-special character inside the quotes", () => {
    const names = [
      "My Movie 中文.mkv",
      "a$b.mkv",
      "wow!.mkv",
      'say "hi".mkv',
      "back`tick.mkv",
      "it's.mkv",
      "a&b.mkv",
      "100%.mkv",
      "c#d?e.mkv",
    ]
    const cmd = mpvCommand(
      names.map((n) => ({ url: enc(n), subUrls: [enc(n + ".srt")] })),
    )
    const quoted = [...cmd.matchAll(/"([^"]*)"/g)].map((m) => m[1])
    for (const q of quoted.filter((q) => q.startsWith("http"))) {
      expect(q).not.toMatch(/["$`\\!]/)
    }
    expect(quoted.filter((q) => q.startsWith("http"))).toHaveLength(
      names.length * 2,
    )
  })

  it("percent-encodes specials that were not encoded by the caller", () => {
    const cmd = mpvCommand([{ url: 'http://h/d/a"$`\\!.mkv', subUrls: [] }])
    expect(cmd).toBe('mpv "http://h/d/a%22%24%60%5C%21.mkv"')
  })

  it("keeps the share password in the query", () => {
    const url = `http://h/sd/a.mkv?pwd=p%24w`
    expect(mpvCommand([{ url, subUrls: [] }])).toBe(`mpv "${url}"`)
  })
})
