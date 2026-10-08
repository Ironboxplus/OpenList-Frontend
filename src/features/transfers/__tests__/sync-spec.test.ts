import { describe, expect, it } from "vitest"
import { buildSpec } from "../sync-spec"

const base = {
  mode: "copy" as const,
  src: " local:/tmp/a ",
  dst: "/local ",
  dryRun: false,
  sizeOnly: true,
  trackRenames: false,
  resync: true,
  force: true,
  filters: "- *.tmp\n\n  + docs/**  \n",
  transfers: "",
  checkers: "",
  maxDelete: "",
}

describe("buildSpec", () => {
  it("trims paths, splits filters one per line and skips blanks", () => {
    const spec = buildSpec(base)
    expect(spec).toMatchObject({
      mode: "copy",
      src: "local:/tmp/a",
      dst: "/local",
      size_only: true,
      filters: ["- *.tmp", "+ docs/**"],
    })
  })
  it("leaves out empty optional numbers", () => {
    const spec = buildSpec(base)
    expect(spec).not.toHaveProperty("transfers")
    expect(spec).not.toHaveProperty("checkers")
    expect(spec).not.toHaveProperty("max_delete")
  })
  it("sends resync/force only for bisync", () => {
    expect(buildSpec(base)).not.toHaveProperty("resync")
    expect(buildSpec({ ...base, mode: "bisync" })).toMatchObject({
      resync: true,
      force: true,
    })
  })
  it("passes numbers through, and max_delete 0 is meaningful", () => {
    expect(
      buildSpec({ ...base, transfers: "8", checkers: "16", maxDelete: "0" }),
    ).toMatchObject({ transfers: 8, checkers: 16, max_delete: 0 })
  })
  it("ignores garbage numbers", () => {
    const spec = buildSpec({ ...base, transfers: "abc", maxDelete: "-3" })
    expect(spec).not.toHaveProperty("transfers")
    expect(spec).not.toHaveProperty("max_delete")
  })
})
