import { render } from "@solidjs/testing-library"
import { describe, expect, it, vi } from "vitest"
import type { PackStats } from "~/platform/contracts/task"

vi.mock("~/hooks", async () => {
  const i18n = await import("@solid-primitives/i18n")
  const { dict } = await import("~/lang/en/entry")
  const flat = i18n.flatten(dict) as Record<string, string>
  return {
    useT: () => (key: string, params?: Record<string, string | number>) => {
      const tpl = flat[key]
      if (typeof tpl !== "string") return key
      return params ? i18n.resolveTemplate(tpl, params) : tpl
    },
  }
})

import { PackStatsBlock } from "../TaskDetail"

const stats = (over: Partial<PackStats> = {}): PackStats => ({
  packed_files: 61,
  packs: 2,
  bytes_in: 1000,
  bytes_out: 400,
  dead_removed: 0,
  ...over,
})

describe("PackStatsBlock", () => {
  it("shows the counts and the saved share", () => {
    const v = render(() => <PackStatsBlock stats={stats()} stage="packing" />)
    expect(v.getByTestId("pack-stage").textContent).toBe("Packing")
    expect(v.getByTestId("pack-ratio").textContent).toContain("60% saved")
  })

  it("shows conflicts only when there are some, in a warning tone", () => {
    const none = render(() => <PackStatsBlock stats={stats()} />)
    expect(
      none.container.querySelector("[data-testid=pack-conflicts]"),
    ).toBeNull()
    none.unmount()
    const some = render(() => (
      <PackStatsBlock stats={stats({ conflicts: 3 })} />
    ))
    const el = some.getByTestId("pack-conflicts")
    expect(el.textContent).toBe("3")
    expect(el.className).toContain("amber")
  })

  it("unpack jobs show unpacked files instead of the packing numbers", () => {
    const v = render(() => (
      <PackStatsBlock
        stats={stats({
          unpacked_files: 61,
          unpacked_bytes: 1000,
          packs_fetched: 2,
        })}
      />
    ))
    expect(v.container.textContent).toContain("Files unpacked")
    expect(v.container.querySelector("[data-testid=pack-ratio]")).toBeNull()
  })
})

describe("PackStatsBlock: job-level pack fields", () => {
  it("renders whichever counters are present, and not the ones that are absent", () => {
    const v = render(() => (
      <PackStatsBlock
        stage="packing"
        stats={{
          small_files: 900,
          packed_files: 880,
          packs_written: 3,
          packs_total: 7,
          bytes_in: 2000,
          bytes_out: 500,
          compacted_packs: 1,
          conflicts: 2,
          v1_migrated_dirs: 0,
        }}
      />
    ))
    for (const k of [
      "small_files",
      "packed_files",
      "packs_written",
      "packs_total",
      "compacted_packs",
      "conflicts",
    ]) {
      expect(
        v.container.querySelector(`[data-testid=pack-${k}]`),
      ).not.toBeNull()
    }
    // zero-hiding rows stay hidden at 0; absent ones are not drawn
    expect(
      v.container.querySelector("[data-testid=pack-v1_migrated_dirs]"),
    ).toBeNull()
    expect(
      v.container.querySelector("[data-testid=pack-loose_removed]"),
    ).toBeNull()
    expect(v.getByTestId("pack-ratio").textContent).toContain("75% saved")
  })
})
