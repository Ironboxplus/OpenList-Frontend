import { describe, expect, it } from "vitest"
import { formatDate, formatDateCompact } from "../str"

// `now` is injected so these assertions don't depend on the wall clock.
const NOW = new Date("2026-09-13T12:00:00")

describe("formatDateCompact", () => {
  it("drops the year for dates in the current year, and drops seconds", () => {
    expect(formatDateCompact("2026-01-03T04:58:30", NOW)).toBe("01-03 04:58")
    expect(formatDateCompact("2026-09-13T23:07:09", NOW)).toBe("09-13 23:07")
  })

  it("keeps the year for other years, and omits the time", () => {
    expect(formatDateCompact("2025-12-29T23:50:48", NOW)).toBe("2025-12-29")
    expect(formatDateCompact("2027-02-01T00:00:00", NOW)).toBe("2027-02-01")
  })

  it("never exceeds 11 characters (the column width budget)", () => {
    for (const s of [
      "2026-01-03T04:58:30",
      "2025-12-29T23:50:48",
      "2026-12-31T23:59:59",
      "1999-01-01T00:00:00",
    ]) {
      expect(formatDateCompact(s, NOW).length).toBeLessThanOrEqual(11)
    }
  })

  it("returns '-' instead of NaN for missing or unparseable dates", () => {
    // Regression: several drivers omit `modified`. `new Date("")` is an Invalid
    // Date whose getters are all NaN, which `formatDate` happily renders.
    expect(formatDate("")).toContain("NaN")

    expect(formatDateCompact("")).toBe("-")
    expect(formatDateCompact(undefined)).toBe("-")
    expect(formatDateCompact("not a date")).toBe("-")
  })

  it("treats the epoch sentinel as unknown", () => {
    // Some drivers send 0 / 1970-01-01 to mean "no value"; rendering 1970 is noise.
    expect(formatDateCompact("1970-01-01T00:00:00Z")).toBe("-")
  })

  it("leaves formatDate untouched for callers that need full precision", () => {
    expect(formatDate("2026-01-03T04:58:30")).toBe("2026-01-03 04:58:30")
  })
})
