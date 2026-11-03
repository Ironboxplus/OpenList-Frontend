import { describe, expect, it } from "vitest"
import { mediaTitle } from "../media"
import type { MediaItem } from "../media"

const item = (p: Partial<MediaItem>) => p as MediaItem

describe("mediaTitle", () => {
  it("prefers display_title, then scraped_name, then file_name", () => {
    expect(
      mediaTitle(
        item({ display_title: "D", scraped_name: "S", file_name: "F.mkv" }),
      ),
    ).toBe("D")
    expect(mediaTitle(item({ scraped_name: "S", file_name: "F.mkv" }))).toBe(
      "S",
    )
    expect(mediaTitle(item({ display_title: "", file_name: "F.mkv" }))).toBe(
      "F.mkv",
    )
    expect(mediaTitle(item({}))).toBe("")
  })
})
