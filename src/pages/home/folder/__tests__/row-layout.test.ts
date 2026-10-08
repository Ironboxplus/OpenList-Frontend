import { describe, expect, it } from "vitest"
import {
  isMediaProvider,
  hasMediaInfo,
  shouldUseMediaRows,
} from "../row-layout"

const vid = (over = {}) => ({
  extra: { duration: 7139, resolution: "4K" },
  ...over,
})
const doc = (over = {}) => ({ ...over })

describe("isMediaProvider", () => {
  it("matches the provider string the backend actually sends", () => {
    // `storage.Config().Name`, same literal used by previews/movi-quality.ts.
    expect(isMediaProvider("115 Open")).toBe(true)
  })
  it("rejects everything else, including the pre-fix sentinel", () => {
    // fs/list used to always return "unknown" (fsread.go declared it and never
    // assigned). If that regresses, the media layout must not silently engage.
    expect(isMediaProvider("unknown")).toBe(false)
    expect(isMediaProvider("")).toBe(false)
    expect(isMediaProvider(undefined)).toBe(false)
    expect(isMediaProvider("Local")).toBe(false)
    expect(isMediaProvider("115")).toBe(false)
  })
})

describe("hasMediaInfo", () => {
  it("counts a thumbnail on its own, directories included", () => {
    expect(hasMediaInfo({ thumb: "https://thumb.115.com/x" })).toBe(true)
    expect(hasMediaInfo({ thumb: "https://thumb.115.com/x", is_dir: true })).toBe(
      true,
    )
  })
  it("counts duration or resolution", () => {
    expect(hasMediaInfo({ extra: { duration: 7139 } })).toBe(true)
    expect(hasMediaInfo({ extra: { resolution: "1080P" } })).toBe(true)
  })
  it("does not count starred or tags alone", () => {
    // These add a badge but nothing the two-line layout is for; a folder of
    // starred PDFs should stay in the table.
    expect(hasMediaInfo({ extra: { starred: true } })).toBe(false)
    expect(hasMediaInfo({ extra: { tags: ["a", "b"] } })).toBe(false)
  })
  it("never throws on a malformed payload", () => {
    expect(hasMediaInfo({})).toBe(false)
    expect(hasMediaInfo({ extra: null })).toBe(false)
    expect(hasMediaInfo({ extra: "nonsense" })).toBe(false)
    expect(hasMediaInfo({ extra: { duration: "abc" } })).toBe(false)
    expect(hasMediaInfo({ thumb: "" })).toBe(false)
  })
})

describe("shouldUseMediaRows", () => {
  it("requires an allowlisted provider", () => {
    expect(shouldUseMediaRows("Local", [vid(), vid()])).toBe(false)
    expect(shouldUseMediaRows("unknown", [vid(), vid()])).toBe(false)
    expect(shouldUseMediaRows(undefined, [vid(), vid()])).toBe(false)
  })

  it("engages when most entries have media info", () => {
    expect(shouldUseMediaRows("115 Open", [vid(), vid(), doc()])).toBe(true)
  })

  it("stays on the table for a 115 folder of documents", () => {
    // The whole point of layer 2: media rows would show "title + size" over two
    // lines here, strictly worse than the table.
    expect(shouldUseMediaRows("115 Open", [doc(), doc(), doc()])).toBe(false)
    expect(shouldUseMediaRows("115 Open", [vid(), doc(), doc()])).toBe(false)
  })

  it("treats an exact tie as not-a-majority", () => {
    expect(shouldUseMediaRows("115 Open", [vid(), doc()])).toBe(false)
    expect(shouldUseMediaRows("115 Open", [vid(), vid(), doc(), doc()])).toBe(
      false,
    )
  })

  it("keeps the table for an empty directory", () => {
    // No evidence either way; the table is the established default.
    expect(shouldUseMediaRows("115 Open", [])).toBe(false)
  })

  it("does not let subtitles outvote the videos they belong to", () => {
    // Real names from /MOV/Anime/少女终末旅行/SPs, which holds 22 .mkv and 24
    // .ass — a plain majority over all entries put this unambiguously-media
    // directory back on the table.
    const base =
      "[Airota&Nekomoe kissaten&VCB-Studio] Shoujo Shuumatsu Ryokou [Mini Character Anime 09][Ma10p_1080p][x265_flac]"
    const objs = [
      { name: `${base}.mkv`, extra: { duration: 90, resolution: "1080P" } },
      { name: `${base}.sc.ass` },
      { name: `${base}.tc.ass` },
    ]
    expect(shouldUseMediaRows("115 Open", objs)).toBe(true)
  })

  it("still counts unrelated non-media files as contenders", () => {
    // A sidecar is recognised by belonging to a specific video, not by being a
    // small file — so documents that share no stem keep their vote.
    const objs = [
      { name: "movie.mkv", extra: { duration: 90 } },
      { name: "readme.txt" },
      { name: "notes.pdf" },
    ]
    expect(shouldUseMediaRows("115 Open", objs)).toBe(false)
  })

  it("never treats a folder as a sidecar", () => {
    // A directory is content in its own right even if a video shares its name.
    const objs = [
      { name: "Season 1.mkv", extra: { duration: 90 } },
      { name: "Season 1", is_dir: true },
      { name: "Season 2", is_dir: true },
    ]
    expect(shouldUseMediaRows("115 Open", objs)).toBe(false)
  })

  it("engages for a folder listing whose entries have cover art", () => {
    // e.g. /MOV/Live — all directories, each one a title, with 115 folder covers.
    const covered = { thumb: "https://thumb.115.com/c", is_dir: true }
    expect(shouldUseMediaRows("115 Open", [covered, covered, covered])).toBe(
      true,
    )
  })
})
