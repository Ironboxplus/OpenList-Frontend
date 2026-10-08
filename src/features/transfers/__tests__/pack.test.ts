import { describe, expect, it } from "vitest"
import type { PackOptions } from "~/platform/contracts/task"
import {
  packFormFrom,
  packSavedPercent,
  packSpecPart,
  packStage,
  sizeBytes,
  splitSize,
  validatePack,
} from "../pack"
import { buildSpec } from "../sync-spec"

// What GET /admin/sync/pack_defaults answers (DefaultPackOptions).
const defaults: PackOptions = {
  enabled: true,
  threshold: 8 << 20,
  min_files: 8,
  max_pack_bytes: 1 << 30,
  store_suffixes: [".zip"],
}

describe("sizes", () => {
  it("shows the default threshold as 8 M and the max pack as 1 G", () => {
    const f = packFormFrom(defaults)
    expect(f.threshold).toEqual({ value: "8", unit: "M" })
    expect(f.maxPack).toEqual({ value: "1", unit: "G" })
    expect(f.minFiles).toBe("8")
  })
  it("falls back to K for sizes that are not whole megabytes", () => {
    expect(splitSize(1536 * 1024)).toEqual({ value: "1536", unit: "K" })
    expect(splitSize(512)).toEqual({ value: "1", unit: "K" })
  })
  it("turns value and unit into bytes; blank or non-positive is undefined", () => {
    expect(sizeBytes({ value: "8", unit: "M" })).toBe(8 << 20)
    expect(sizeBytes({ value: "0.5", unit: "G" })).toBe(512 << 20)
    expect(sizeBytes({ value: "", unit: "M" })).toBeUndefined()
    expect(sizeBytes({ value: "-1", unit: "M" })).toBeUndefined()
    expect(sizeBytes({ value: "abc", unit: "M" })).toBeUndefined()
  })
})

describe("packSpecPart / buildSpec", () => {
  const form = { ...packFormFrom(defaults), pack: true }
  const base = {
    mode: "copy" as const,
    src: "local:/a",
    dst: "/b",
    dryRun: false,
    sizeOnly: false,
    trackRenames: false,
    resync: false,
    force: false,
    filters: "",
    transfers: "",
    checkers: "",
    maxDelete: "",
  }
  it("pack on: enabled with the numbers in bytes", () => {
    expect(packSpecPart("copy", form)).toEqual({
      pack: {
        enabled: true,
        threshold: 8 << 20,
        min_files: 8,
        max_pack_bytes: 1 << 30,
      },
    })
  })
  it("unpack on sends unpack and no pack block", () => {
    expect(
      packSpecPart("sync", { ...form, pack: false, unpack: true }),
    ).toEqual({ unpack: true })
  })
  it("sends nothing when both are off, or for bisync and check", () => {
    expect(packSpecPart("copy", { ...form, pack: false })).toEqual({})
    expect(packSpecPart("bisync", form)).toEqual({})
    expect(
      packSpecPart("check", { ...form, pack: false, unpack: true }),
    ).toEqual({})
    expect(packSpecPart("copy", undefined)).toEqual({})
  })
  it("buildSpec carries the pack block, and omits it when the backend has none", () => {
    expect(buildSpec({ ...base, pack: form })).toHaveProperty(
      "pack.enabled",
      true,
    )
    expect(buildSpec(base)).not.toHaveProperty("pack")
    expect(buildSpec(base)).not.toHaveProperty("unpack")
    expect(
      buildSpec({ ...base, mode: "bisync", pack: form }),
    ).not.toHaveProperty("pack")
  })
  it("a cleared field is left out so the backend default applies", () => {
    const spec = packSpecPart("copy", {
      ...form,
      threshold: { value: "", unit: "M" },
      minFiles: "",
    }) as { pack: Partial<PackOptions> }
    expect(spec.pack).toEqual({ enabled: true, max_pack_bytes: 1 << 30 })
  })
})

describe("validatePack", () => {
  const form = { ...packFormFrom(defaults), pack: true }
  it("accepts the defaults", () => {
    expect(validatePack("copy", form)).toBeUndefined()
  })
  it("pack and unpack together are rejected", () => {
    expect(validatePack("sync", { ...form, unpack: true })).toBe(
      "transfers.form.pack_exclusive",
    )
  })
  it("rejects nonsense sizes and file counts, only while packing", () => {
    expect(
      validatePack("copy", { ...form, threshold: { value: "-2", unit: "M" } }),
    ).toBe("transfers.form.pack_invalid")
    expect(validatePack("copy", { ...form, minFiles: "1.5" })).toBe(
      "transfers.form.pack_invalid",
    )
    expect(validatePack("copy", { ...form, pack: false, minFiles: "x" })).toBe(
      undefined,
    )
  })
  it("modes without packing are never invalid", () => {
    expect(validatePack("bisync", { ...form, unpack: true })).toBeUndefined()
  })
})

describe("stats", () => {
  it("saved percent is the share of bytes the packs spared", () => {
    const s = {
      packed_files: 10,
      packs: 1,
      bytes_in: 1000,
      bytes_out: 400,
      dead_removed: 0,
    }
    expect(packSavedPercent(s)).toBe(60)
    expect(packSavedPercent({ ...s, bytes_out: 0 })).toBeUndefined()
    expect(packSavedPercent(undefined)).toBeUndefined()
  })
  it("only packing and unpacking count as pack stages", () => {
    expect(packStage("packing")).toBe("packing")
    expect(packStage("unpacking")).toBe("unpacking")
    expect(packStage("transferring")).toBeUndefined()
    expect(packStage(undefined)).toBeUndefined()
  })
})

describe("backends without min_files", () => {
  const { min_files: _drop, ...noMin } = defaults
  it("has no min-files field in the form and none in the body", () => {
    const f = { ...packFormFrom(noMin), pack: true }
    expect(f.minFiles).toBeUndefined()
    expect(validatePack("copy", f)).toBeUndefined()
    expect(packSpecPart("copy", f)).toEqual({
      pack: { enabled: true, threshold: 8 << 20, max_pack_bytes: 1 << 30 },
    })
  })
})
