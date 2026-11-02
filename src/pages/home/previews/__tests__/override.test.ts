import { describe, expect, it } from "vitest"
import {
  applyPreviewOverride,
  parsePreviewSettings,
  previewId,
} from "../override"

const list = ["movi_video", "video", "iframe-Online", "download"].map(
  (key) => ({ key }),
)
const keys = (l: { key: string }[]) => l.map((p) => p.key)

describe("previewId", () => {
  it("names previews the way AList's preview_settings does", () => {
    expect(previewId("movi_video")).toBe("builtin:movi_video")
    expect(previewId("iframe-Online")).toBe("iframe:Online")
    expect(previewId("download")).toBe("download")
  })
})

describe("parsePreviewSettings", () => {
  it("reads AList's format and lower-cases extensions", () => {
    const raw = JSON.stringify({
      MKV: { order: ["builtin:video"], disabled: ["builtin:movi_video"] },
    })
    expect(parsePreviewSettings(raw)).toEqual({
      mkv: { order: ["builtin:video"], disabled: ["builtin:movi_video"] },
    })
  })
  it("treats anything unusable as no overrides", () => {
    for (const raw of ["", "{}", "not json", "[]", "null", "5", '{"mkv":5}']) {
      expect(parsePreviewSettings(raw)).toEqual({})
    }
  })
  it("drops entries that are not strings", () => {
    expect(
      parsePreviewSettings('{"a":{"order":["x",1,null],"disabled":"nope"}}'),
    ).toEqual({ a: { order: ["x"], disabled: undefined } })
  })
})

describe("applyPreviewOverride", () => {
  it("changes nothing without an override", () => {
    expect(applyPreviewOverride(list, undefined)).toBe(list)
    expect(keys(applyPreviewOverride(list, {}))).toEqual(keys(list))
  })
  it("puts ordered previews first, the rest keep their order", () => {
    const out = applyPreviewOverride(list, {
      order: ["iframe:Online", "builtin:video"],
    })
    expect(keys(out)).toEqual([
      "iframe-Online",
      "video",
      "movi_video",
      "download",
    ])
  })
  it("drops disabled previews but never the download page", () => {
    const out = applyPreviewOverride(list, {
      disabled: ["builtin:movi_video", "download", "iframe:Online"],
    })
    expect(keys(out)).toEqual(["video", "download"])
  })
  it("ignores ids that are not in the list", () => {
    const out = applyPreviewOverride(list, {
      order: ["builtin:nope"],
      disabled: ["iframe:gone"],
    })
    expect(keys(out)).toEqual(keys(list))
  })
})
