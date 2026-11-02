import { describe, expect, it } from "vitest"
import type { MediaEpisodeView, MediaItem } from "~/types"
import { episodeRows, episodeText } from "../episodes"
import { videoKindLabel } from "../videoKind"

const view = (
  season: number,
  episode: number,
  title = "",
  extra: Partial<MediaEpisodeView> = {},
): MediaEpisodeView => ({
  file_name: `S${season}/e${episode}.mkv`,
  season,
  episode,
  title,
  overview: "",
  ...extra,
})

const item = (over: Partial<MediaItem>): MediaItem =>
  ({ episodes: "", ...over }) as MediaItem

describe("episodeRows", () => {
  it("keeps the playable list and adds what episode_list knows to its rows", () => {
    const rows = episodeRows(
      item({
        episodes: JSON.stringify([
          { file_name: "S1/e1.mkv", index: 1, title: "Pilot" },
          { file_name: "S1/e2.mkv", index: 2, title: "Two" },
        ]),
        episode_list: [
          view(1, 1, "Pilot", { overview: "It begins", still_url: "/s1" }),
        ],
      }),
    )
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({
      index: 1,
      season: 1,
      episode: 1,
      overview: "It begins",
      still_url: "/s1",
    })
    // an episode the detail does not know stays as the JSON had it
    expect(rows[1].season).toBeUndefined()
  })

  it("stands on episode_list alone when the item has no episodes JSON", () => {
    const rows = episodeRows(item({ episode_list: [view(1, 2), view(1, 1)] }))
    expect(rows.map((r) => r.index)).toEqual([1, 2])
  })

  it("numbers by position when the show spans seasons, as the backend does", () => {
    const rows = episodeRows(
      item({ episode_list: [view(2, 1), view(1, 1), view(1, 2)] }),
    )
    expect(rows.map((r) => [r.season, r.episode, r.index])).toEqual([
      [1, 1, 1],
      [1, 2, 2],
      [2, 1, 3],
    ])
  })

  it("is empty for a movie", () => {
    expect(episodeRows(item({}))).toEqual([])
  })
})

describe("episodeText", () => {
  it("prints season and episode when known", () => {
    expect(
      episodeText({
        file_name: "a",
        index: 3,
        title: "Third",
        season: 1,
        episode: 3,
      }),
    ).toBe("S01E03 · Third")
  })

  it("falls back to the index, then the title, then the file name", () => {
    expect(episodeText({ file_name: "a", index: 3, title: "Third" })).toBe(
      "第3集 Third",
    )
    expect(episodeText({ file_name: "a", index: 0, title: "Special" })).toBe(
      "Special",
    )
    expect(episodeText({ file_name: "a.mkv", index: 0, title: "" })).toBe(
      "a.mkv",
    )
  })
})

describe("videoKindLabel", () => {
  const t = (k: string) => `<${k}>`
  it("labels the four kinds and leaves anything else as it is", () => {
    expect(videoKindLabel(t, "anime")).toBe("<media.kind.anime>")
    expect(videoKindLabel(t, "collection")).toBe("<media.kind.collection>")
    expect(videoKindLabel(t, "other")).toBe("other")
    expect(videoKindLabel(t, undefined)).toBe("")
  })
})
