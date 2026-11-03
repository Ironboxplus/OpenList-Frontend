import { beforeEach, describe, expect, it } from "vitest"
import {
  createProgressTracker,
  getPlayerChoice,
  pickEngine,
  setPlayerChoice,
  type ProgressSave,
} from "../player-choice"

describe("player choice", () => {
  beforeEach(() => localStorage.clear())

  it("defaults to movi and remembers the choice", () => {
    expect(getPlayerChoice()).toBe("movi")
    setPlayerChoice("artplayer")
    expect(getPlayerChoice()).toBe("artplayer")
    setPlayerChoice("movi")
    expect(getPlayerChoice()).toBe("movi")
  })

  it("ignores a stored value it does not know", () => {
    localStorage.setItem("media_video_player", "vlc")
    expect(getPlayerChoice()).toBe("movi")
  })

  it("movi unless the choice or a cloud transcode says Artplayer", () => {
    expect(pickEngine("movi", false)).toBe("movi")
    expect(pickEngine("artplayer", false)).toBe("artplayer")
  })

  it("a cloud transcode plays in Artplayer whatever was chosen", () => {
    expect(pickEngine("movi", true)).toBe("artplayer")
    expect(pickEngine("artplayer", true)).toBe("artplayer")
  })
})

describe("progress tracker", () => {
  const setup = () => {
    const saves: ProgressSave[] = []
    let t = 1_000_000
    const tracker = createProgressTracker(
      (p) => saves.push(p),
      () => t,
    )
    return { saves, tracker, advance: (ms: number) => (t += ms) }
  }

  it("saves at most once per 10 s while playing", () => {
    const { saves, tracker, advance } = setup()
    tracker.timeupdate(10, 100)
    advance(3000)
    tracker.timeupdate(13, 100)
    advance(8000)
    tracker.timeupdate(21, 100)
    expect(saves.map((s) => s.position)).toEqual([10, 21])
    expect(saves.every((s) => !s.played)).toBe(true)
  })

  it("saves nothing before the 2 s mark unless played", () => {
    const { saves, tracker } = setup()
    tracker.timeupdate(1, 100)
    tracker.pause(1.5, 100)
    expect(saves).toEqual([])
  })

  it("saves on pause", () => {
    const { saves, tracker } = setup()
    tracker.pause(42, 100)
    expect(saves).toEqual([{ position: 42, duration: 100, played: false }])
  })

  it("marks the end as played and does not overwrite it on close", () => {
    const { saves, tracker } = setup()
    tracker.ended(99, 100)
    tracker.close()
    expect(saves).toEqual([{ position: 99, duration: 100, played: true }])
  })

  it("saves the last seen position on close, after the element is gone", () => {
    const { saves, tracker } = setup()
    tracker.timeupdate(30, 100)
    saves.length = 0
    tracker.close()
    expect(saves).toEqual([{ position: 30, duration: 100, played: false }])
  })

  it("reports the last position for a player switch", () => {
    const { tracker } = setup()
    tracker.timeupdate(55, 100)
    expect(tracker.position()).toBe(55)
  })
})
