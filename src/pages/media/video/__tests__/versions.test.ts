import { describe, expect, it } from "vitest"
import type { MediaEpisodeView, MediaItem } from "~/types"
import { episodeRows } from "../episodes"
import {
  isVersionSet,
  versionCount,
  versionLabels,
  versionRows,
} from "../versions"

const FLIPPED =
  "Flipped.2010.BluRay.1080p.2Audio.DTS-HD.MA5.1.x265.10bit-BeiTai.mkv"
const FLIPPED_AV1 = `av1_recode_${FLIPPED}`
const LAMBS =
  "The.Silence.of.the.Lambs.1991.CC.Remastered.Bluray.1080p.x265.10bit.2Audios.MNHD-FRDS.mkv"
const LAMBS_SUB = LAMBS.replace(".mkv", "-sub_built_in.mkv")

const item = (over: Partial<MediaItem>): MediaItem =>
  ({ episodes: "", ...over }) as MediaItem

const entry = (
  file_name: string,
  episode: number,
  extra: Partial<MediaEpisodeView> = {},
): MediaEpisodeView => ({
  file_name,
  season: 0,
  episode,
  title: file_name.replace(/\.[^.]+$/, ""),
  overview: "",
  ...extra,
})

describe("versionLabels", () => {
  it("names a re-encode by the tokens its file name adds", () => {
    const labels = versionLabels([FLIPPED_AV1, FLIPPED])
    expect(labels[0]).toBe("av1 recode")
    // nothing of its own: the file name without the extension
    expect(labels[1]).toBe(FLIPPED.replace(/\.mkv$/, ""))
  })

  it("names the built-in-subtitle cut by what differs", () => {
    const labels = versionLabels([LAMBS, LAMBS_SUB])
    expect(labels[1]).toBe("sub built in")
    expect(labels[0]).toBe(LAMBS.replace(/\.mkv$/, ""))
  })

  it("tells release folders apart by the folder tokens", () => {
    const labels = versionLabels([
      "Memories.1995.1080p.BluRay-QuickIO/memories.mkv",
      "Memories.1995.2160p.UHD-FraMeSToR/memories.mkv",
    ])
    expect(labels).toEqual(["1080p BluRay QuickIO", "2160p UHD FraMeSToR"])
  })

  it("is case-insensitive when it compares tokens", () => {
    expect(versionLabels(["Film.1080P.mkv", "film.4K.mkv"])).toEqual([
      "1080P",
      "4K",
    ])
  })

  it("falls back to the file name when two versions would get the same label", () => {
    const labels = versionLabels(["a.x.mkv", "a-x.mkv", "b.mkv"])
    expect(labels).toEqual(["a.x", "a-x", "b"])
  })
})

describe("version sets", () => {
  const filmEntries = [
    entry(FLIPPED, 1, { version: true }),
    entry(FLIPPED_AV1, 2, { version: true }),
  ]

  it("a film with versions shows a picker, not episodes", () => {
    const film = item({
      versions: 2,
      episode_list: filmEntries,
      episodes: JSON.stringify([
        { file_name: FLIPPED, index: 1, title: "t", version: true },
        { file_name: FLIPPED_AV1, index: 2, title: "t2", version: true },
      ]),
    })
    expect(isVersionSet(film)).toBe(true)
    expect(versionCount(film)).toBe(2)
    const rows = versionRows(film)
    expect(rows.map((r) => r.index)).toEqual([1, 2])
    expect(rows[0].file_name).toBe(FLIPPED)
  })

  it("is recognised from the list item's own episodes when the count is absent", () => {
    const film = item({
      episodes: JSON.stringify([
        { file_name: "a.mkv", index: 1, title: "a", version: true },
        { file_name: "b.mkv", index: 2, title: "b", version: true },
      ]),
    })
    expect(versionCount(film)).toBe(2)
  })

  it("an episodic item keeps its episode list and has no versions", () => {
    const show = item({
      episodes: JSON.stringify([
        { file_name: "S1/e1.mkv", index: 1, title: "Pilot" },
        { file_name: "S1/e2.mkv", index: 2, title: "Two" },
      ]),
      episode_list: [entry("S1/e1.mkv", 1), entry("S1/e2.mkv", 2)],
    })
    expect(isVersionSet(show)).toBe(false)
    expect(versionCount(show)).toBe(0)
    expect(versionRows(show)).toEqual([])
    expect(episodeRows(show).map((r) => r.index)).toEqual([1, 2])
    expect(episodeRows(show).some((r) => r.version)).toBe(false)
  })

  it("a single-file film is neither", () => {
    expect(isVersionSet(item({ versions: undefined }))).toBe(false)
  })
})
