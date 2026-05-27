import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { SubtitleManager, type SubtitleFile } from "../subtitle-manager"

const tick = () => new Promise((r) => setTimeout(r, 0))

describe("movi_video integration", () => {
  describe("SubtitleManager with movi-player element", () => {
    let wrapper: HTMLDivElement
    let moviEl: any
    let manager: SubtitleManager

    beforeEach(() => {
      wrapper = document.createElement("div")
      document.body.appendChild(wrapper)
      moviEl = document.createElement("div")
      Object.defineProperty(moviEl, "clientWidth", {
        value: 1920,
        writable: true,
      })
      Object.defineProperty(moviEl, "clientHeight", {
        value: 1080,
        writable: true,
      })
      moviEl.currentTime = 0
      moviEl.getSubtitleLangs = vi.fn(() => [])
      moviEl.getCanvas = vi.fn(
        () =>
          Object.assign(document.createElement("canvas"), {
            width: 1920,
            height: 1080,
          }) as HTMLCanvasElement,
      )
      moviEl.selectSubtitleLang = vi.fn()
      moviEl.setSubtitleDelay = vi.fn()
      moviEl.getSubtitleDelay = vi.fn(() => 0)
      wrapper.appendChild(moviEl)
    })

    afterEach(() => {
      manager?.destroy()
      wrapper?.remove()
    })

    it("creates overlay canvas as sibling of movi element", async () => {
      manager = new SubtitleManager(moviEl)
      manager.registerTracks([{ name: "test.ass", url: "/test.ass" }])

      moviEl.getSubtitleLangs = () => [
        { lang: "sub0", label: "test.ass", active: true },
      ]
      manager.handleTrackChange()
      await tick()

      const canvas = wrapper.querySelector("canvas")
      expect(canvas).not.toBeNull()
      expect(canvas?.style.pointerEvents).toBe("none")
      expect(canvas?.style.position).toBe("absolute")
    })

    it("removes overlay canvas on destroy", async () => {
      manager = new SubtitleManager(moviEl)
      manager.registerTracks([{ name: "test.ass", url: "/test.ass" }])

      moviEl.getSubtitleLangs = () => [
        { lang: "sub0", label: "test.ass", active: true },
      ]
      manager.handleTrackChange()
      await tick()
      expect(wrapper.querySelector("canvas")).not.toBeNull()

      manager.destroy()
      expect(wrapper.querySelector("canvas")).toBeNull()
    })

    it("generates track HTML for mixed subtitle formats", () => {
      manager = new SubtitleManager(moviEl)
      const files: SubtitleFile[] = [
        { name: "English.srt", url: "/subs/en.srt" },
        { name: "Chinese.ass", url: "/subs/zh.ass" },
        { name: "Korean.sup", url: "/subs/kr.sup" },
        { name: "French.vtt", url: "/subs/fr.vtt" },
      ]
      manager.registerTracks(files)

      const html = manager.getTrackHTML()
      expect(html).toContain('srclang="sub0"')
      expect(html).toContain('srclang="sub1"')
      expect(html).toContain('srclang="sub2"')
      expect(html).toContain('srclang="sub3"')
      expect(html).toContain('data-format="srt"')
      expect(html).toContain('data-format="ass"')
      expect(html).toContain('data-format="sup"')
      expect(html).toContain('data-format="vtt"')
      expect(html).toContain("English.srt")
      expect(html).toContain("Chinese.ass")
    })

    it("syncs time offset to active ASS renderer", async () => {
      manager = new SubtitleManager(moviEl)
      manager.registerTracks([{ name: "test.ass", url: "/test.ass" }])

      moviEl.getSubtitleLangs = () => [
        { lang: "sub0", label: "test.ass", active: true },
      ]
      manager.handleTrackChange()
      await tick()

      manager.setTimeOffset(3.0)
      expect(manager.getTimeOffset()).toBe(3.0)
    })

    it("handles rapid track switching without errors", async () => {
      manager = new SubtitleManager(moviEl)
      manager.registerTracks([
        { name: "a.ass", url: "/a.ass" },
        { name: "b.sup", url: "/b.sup" },
        { name: "c.srt", url: "/c.srt" },
      ])

      moviEl.getSubtitleLangs = () => [
        { lang: "sub0", label: "a.ass", active: true },
        { lang: "sub1", label: "b.sup", active: false },
        { lang: "sub2", label: "c.srt", active: false },
      ]
      manager.handleTrackChange()
      await tick()
      expect(manager.getActiveRenderer()).toBe("ass")

      moviEl.getSubtitleLangs = () => [
        { lang: "sub0", label: "a.ass", active: false },
        { lang: "sub1", label: "b.sup", active: true },
        { lang: "sub2", label: "c.srt", active: false },
      ]
      manager.handleTrackChange()
      await tick()
      expect(manager.getActiveRenderer()).toBe("sup")

      moviEl.getSubtitleLangs = () => [
        { lang: "sub0", label: "a.ass", active: false },
        { lang: "sub1", label: "b.sup", active: false },
        { lang: "sub2", label: "c.srt", active: true },
      ]
      manager.handleTrackChange()
      await tick()
      expect(manager.getActiveRenderer()).toBe("none")
    })
  })
})
