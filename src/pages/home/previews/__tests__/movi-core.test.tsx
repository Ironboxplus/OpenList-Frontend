import { render } from "@solidjs/testing-library"
import { createSignal } from "solid-js"
import { afterEach, describe, expect, it, vi } from "vitest"

const { registerJassubHost, post } = vi.hoisted(() => ({
  registerJassubHost: vi.fn(async () => {}),
  post: vi.fn(async (url: string) =>
    url === "/fs/video_subtitle"
      ? {
          code: 200,
          data: [
            {
              language: "chi",
              title: "[内置字幕]简体",
              url: "https://h/p/s0",
              type: "ass",
              embedded_title: "简体",
              embedded_order: 0,
            },
            {
              language: "",
              title: "m.srt",
              url: "https://h/p/s1",
              type: "srt",
            },
            {
              language: "",
              title: "m.sup",
              url: "https://h/p/s2",
              type: "sup",
            },
          ],
        }
      : { code: 200, data: [] },
  ),
}))
vi.mock("../movi-jassub", () => ({ registerJassubHost }))
vi.mock("movi-player", () => ({}))
vi.mock("~/hooks", () => ({
  useFetch: (fn: () => any) => [() => false, () => fn()],
}))
vi.mock("~/store", () => ({
  password: () => "",
  setShouldKeepState: vi.fn(),
}))
vi.mock("~/utils", () => ({
  asPreview: (u: string) => u,
  r: { post },
}))

import { MoviCore } from "../movi_core"

const settle = async () => {
  for (let i = 0; i < 20; i++) await new Promise((r) => setTimeout(r, 0))
}

describe("MoviCore", () => {
  afterEach(() => {
    document.body.innerHTML = ""
    vi.unstubAllGlobals()
  })

  const mount = async (body?: ArrayBuffer) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        arrayBuffer: async () =>
          body ?? new TextEncoder().encode("[Script Info]").buffer,
      })),
    )
    const r = render(() => (
      <MoviCore path="/m/a.mkv" rawUrl="http://x/a.mkv" provider="Local" />
    ))
    await settle()
    return r.container.querySelector("movi-player") as HTMLElement
  }

  it("registers the JASSUB host before the first player is built", async () => {
    const el = await mount()
    expect(el).not.toBeNull()
    expect(registerJassubHost).toHaveBeenCalled()
    expect(registerJassubHost.mock.invocationCallOrder[0]).toBeLessThan(
      post.mock.invocationCallOrder[0],
    )
  })

  it("gives movi the fallback font for ASS", async () => {
    const el = await mount()
    const v = el.getAttribute("subtitlefallbackfont")!
    expect(v.startsWith("Source Han Sans CN|")).toBe(true)
    expect(v.endsWith("/static/fonts/SourceHanSansCN-Bold.woff2")).toBe(true)
  })

  it("declares ASS as a <track data-format=ass>, SRT as vtt, SUP as sup", async () => {
    const el = await mount()
    const t = Array.from(el.querySelectorAll("track"))
    expect(t.map((x) => x.getAttribute("data-format"))).toEqual([
      "ass",
      "vtt",
      "sup",
    ])
  })

  it("points a UTF-16 .ass track at its UTF-8 copy", async () => {
    const bytes = [0xff, 0xfe]
    for (const ch of "[Script Info]") bytes.push(ch.charCodeAt(0), 0)
    URL.createObjectURL = vi.fn(() => "blob:utf8-copy")
    URL.revokeObjectURL = vi.fn()
    const el = await mount(new Uint8Array(bytes).buffer)
    const [a, b] = Array.from(el.querySelectorAll("track"))
    expect(a.getAttribute("src")).toBe("blob:utf8-copy")
    expect(b.getAttribute("src")).toBe("https://h/p/s1")
  })

  it("keeps the in-band identity on the extracted track", async () => {
    const el = await mount()
    const [a, b] = Array.from(el.querySelectorAll("track"))
    expect(a.getAttribute("data-inband-title")).toBe("简体")
    expect(a.getAttribute("data-inband-order")).toBe("0")
    expect(b.hasAttribute("data-inband-title")).toBe(false)
  })

  it("a build whose UTF-16 check finishes late does not replace the newer one", async () => {
    const utf16 = [0xff, 0xfe]
    for (const ch of "[Script Info]") utf16.push(ch.charCodeAt(0), 0)
    let releaseFirst!: () => void
    let n = 0
    vi.stubGlobal(
      "fetch",
      vi.fn(() => {
        // the first build's .ass check hangs; the second build's returns at once
        if (n++ === 0) {
          return new Promise((res) => {
            releaseFirst = () =>
              res({ arrayBuffer: async () => new Uint8Array(utf16).buffer })
          })
        }
        return Promise.resolve({
          arrayBuffer: async () => new TextEncoder().encode("x").buffer,
        })
      }),
    )
    URL.createObjectURL = vi.fn(() => "blob:first")
    URL.revokeObjectURL = vi.fn()
    const [raw, setRaw] = createSignal("http://x/a.mkv")
    const r = render(() => (
      <MoviCore path="/m/a.mkv" rawUrl={raw()} provider="Local" />
    ))
    await settle()
    setRaw("http://x/b.mkv")
    await settle()
    expect(r.container.querySelectorAll("movi-player").length).toBe(1)
    releaseFirst()
    await settle()
    const players = r.container.querySelectorAll("movi-player")
    expect(players.length).toBe(1)
    expect(players[0].getAttribute("src")).toBe("http://x/b.mkv")
    // the stale build's UTF-8 copy is released, not leaked
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:first")
  })
})
