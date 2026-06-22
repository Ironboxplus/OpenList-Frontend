import { describe, expect, it } from "vitest"
import { fmtDuration, hasExtra, readExtra } from "../extra-meta"

describe("fmtDuration", () => {
  it("formats sub-hour durations as m:ss", () => {
    expect(fmtDuration(0.5)).toBe("") // <1s rounds toward nothing useful
    expect(fmtDuration(5)).toBe("0:05")
    expect(fmtDuration(65)).toBe("1:05")
    expect(fmtDuration(599)).toBe("9:59")
  })
  it("formats hour+ durations as h:mm:ss", () => {
    expect(fmtDuration(3600)).toBe("1:00:00")
    expect(fmtDuration(3725)).toBe("1:02:05")
  })
  it("accepts numeric strings (115 sends json.Number)", () => {
    expect(fmtDuration("90")).toBe("1:30")
  })
  it("returns '' for non-usable values (never throws)", () => {
    expect(fmtDuration(undefined)).toBe("")
    expect(fmtDuration(null)).toBe("")
    expect(fmtDuration(0)).toBe("")
    expect(fmtDuration(-10)).toBe("")
    expect(fmtDuration("abc")).toBe("")
    expect(fmtDuration({})).toBe("")
    expect(fmtDuration(NaN)).toBe("")
    expect(fmtDuration(Infinity)).toBe("")
  })
})

describe("readExtra (defensive normalization)", () => {
  it("reads a well-formed payload", () => {
    const n = readExtra({
      duration: 125,
      resolution: "1080P",
      starred: true,
      tags: ["a", "b"],
    })
    expect(n).toEqual({
      duration: "2:05",
      resolution: "1080P",
      starred: true,
      tags: ["a", "b"],
    })
  })
  it("treats absent/empty extra as all-empty", () => {
    for (const v of [undefined, null, {}, "nope", 42, []]) {
      const n = readExtra(v as unknown)
      expect(n.duration).toBe("")
      expect(n.resolution).toBe("")
      expect(n.starred).toBe(false)
      expect(n.tags).toEqual([])
    }
  })
  it("ignores wrong-typed fields instead of crashing (API change resilience)", () => {
    const n = readExtra({
      duration: "not-a-number",
      resolution: 1080, // wrong type -> dropped
      starred: "yes", // only literal true counts
      tags: ["ok", 5, null, "fine"], // non-strings filtered out
      unknownFutureKey: { nested: true }, // ignored, no throw
    })
    expect(n.duration).toBe("")
    expect(n.resolution).toBe("")
    expect(n.starred).toBe(false)
    expect(n.tags).toEqual(["ok", "fine"])
  })
})

describe("hasExtra", () => {
  it("is false when nothing is present", () => {
    expect(hasExtra(readExtra(undefined))).toBe(false)
    expect(hasExtra(readExtra({ tags: [] }))).toBe(false)
  })
  it("is true when any field is present", () => {
    expect(hasExtra(readExtra({ starred: true }))).toBe(true)
    expect(hasExtra(readExtra({ resolution: "4K" }))).toBe(true)
    expect(hasExtra(readExtra({ duration: 3 }))).toBe(true)
    expect(hasExtra(readExtra({ tags: ["x"] }))).toBe(true)
  })
})
