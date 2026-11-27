import { createRoot, createSignal } from "solid-js"
import { afterEach, describe, expect, it, vi } from "vitest"

const { sidecar } = vi.hoisted(() => ({
  sidecar: vi.fn<(path: string) => Promise<string[]>>(),
}))
vi.mock("~/utils/mpv-copy", () => ({ fetchSidecarSubtitles: sidecar }))

import { useSidecarSubtitle } from "../sidecar"

const settle = async () => {
  for (let i = 0; i < 20; i++) await new Promise((r) => setTimeout(r, 0))
}

// moved from the player page's VideoBox (video-box.test.tsx) with its rules
describe("the sidecar subtitle of the video in the viewer", () => {
  afterEach(() => sidecar.mockReset())

  it("is empty while the request is out, then the first match", async () => {
    let release!: (v: string[]) => void
    sidecar.mockImplementation(() => new Promise((res) => (release = res)))
    await createRoot(async (dispose) => {
      const url = useSidecarSubtitle(
        () => "/m/a.mkv",
        () => "",
      )
      await settle()
      expect(url()).toBeUndefined()
      release(["https://h/sub-a.srt", "https://h/other.srt"])
      await settle()
      expect(url()).toBe("https://h/sub-a.srt")
      dispose()
    })
  })

  it("drops an answer for a video no longer shown", async () => {
    let releaseA!: (v: string[]) => void
    sidecar.mockImplementation((path: string) =>
      path === "/m/a.mkv"
        ? new Promise((res) => (releaseA = res))
        : Promise.resolve(["https://h/sub-b.srt"]),
    )
    await createRoot(async (dispose) => {
      const [path, setPath] = createSignal("/m/a.mkv")
      const url = useSidecarSubtitle(path, () => "")
      await settle()
      setPath("/m/b.mkv")
      await settle()
      expect(url()).toBe("https://h/sub-b.srt")
      releaseA(["https://h/sub-a.srt"])
      await settle()
      expect(url()).toBe("https://h/sub-b.srt")
      dispose()
    })
  })

  it("stays empty when the request fails", async () => {
    sidecar.mockRejectedValue(new Error("boom"))
    await createRoot(async (dispose) => {
      const url = useSidecarSubtitle(
        () => "/m/a.mkv",
        () => "",
      )
      await settle()
      expect(url()).toBeUndefined()
      dispose()
    })
  })
})
