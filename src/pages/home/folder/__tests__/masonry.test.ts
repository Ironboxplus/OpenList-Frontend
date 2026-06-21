import { describe, expect, it } from "vitest"
import { ObjType } from "~/types"
import {
  clampPreview,
  masonryCardKind,
  masonryClickAction,
  masonryNameAlwaysVisible,
} from "../masonry-card"

describe("masonryCardKind", () => {
  it("renders images as the image itself", () => {
    expect(masonryCardKind({ type: ObjType.IMAGE })).toBe("image")
  })

  it("renders a video with a thumbnail as video-thumb", () => {
    expect(
      masonryCardKind({ type: ObjType.VIDEO, thumb: "http://t/x.jpg" }),
    ).toBe("video-thumb")
  })

  it("renders a video without a thumbnail as a video skeleton", () => {
    expect(masonryCardKind({ type: ObjType.VIDEO })).toBe("video-skeleton")
    expect(masonryCardKind({ type: ObjType.VIDEO, thumb: "" })).toBe(
      "video-skeleton",
    )
  })

  it("renders text files as text", () => {
    expect(masonryCardKind({ type: ObjType.TEXT })).toBe("text")
  })

  it("falls back to an icon card for folders, audio and unknown", () => {
    expect(masonryCardKind({ type: ObjType.FOLDER })).toBe("icon")
    expect(masonryCardKind({ type: ObjType.AUDIO })).toBe("icon")
    expect(masonryCardKind({ type: ObjType.UNKNOWN })).toBe("icon")
  })
})

describe("masonryClickAction", () => {
  it("opens the gallery for images", () => {
    expect(masonryClickAction({ type: ObjType.IMAGE })).toBe("gallery")
  })

  it("navigates for every other type", () => {
    for (const type of [
      ObjType.FOLDER,
      ObjType.VIDEO,
      ObjType.AUDIO,
      ObjType.TEXT,
      ObjType.UNKNOWN,
    ]) {
      expect(masonryClickAction({ type })).toBe("navigate")
    }
  })
})

describe("masonryNameAlwaysVisible", () => {
  it("keeps the label hidden-until-hover for full-bleed media", () => {
    expect(masonryNameAlwaysVisible({ type: ObjType.IMAGE })).toBe(false)
    expect(masonryNameAlwaysVisible({ type: ObjType.VIDEO, thumb: "x" })).toBe(
      false,
    )
  })

  it("keeps the label visible for skeletons, text and icon cards", () => {
    expect(masonryNameAlwaysVisible({ type: ObjType.VIDEO })).toBe(true)
    expect(masonryNameAlwaysVisible({ type: ObjType.TEXT })).toBe(true)
    expect(masonryNameAlwaysVisible({ type: ObjType.FOLDER })).toBe(true)
  })
})

describe("clampPreview", () => {
  it("returns short text unchanged", () => {
    expect(clampPreview("hello")).toBe("hello")
  })

  it("clamps long text to the limit", () => {
    expect(clampPreview("x".repeat(5000)).length).toBe(1200)
    expect(clampPreview("abcdef", 3)).toBe("abc")
  })
})
