import { describe, expect, it } from "vitest"
import { canRetry, classifyFilesError } from "../files-state"

describe("classifyFilesError", () => {
  it.each([
    ["Network Error", "network"],
    ["timeout of 5000ms exceeded", "network"],
    ["permission denied", "forbidden"],
    ["Request failed with status code 403", "forbidden"],
    ["object not found", "not_found"],
    ["failed get storage: storage not found", "storage"],
    ["please add a storage first", "storage"],
    ["something odd", "unknown"],
  ])("%s -> %s", (msg, kind) => {
    expect(classifyFilesError(msg)).toBe(kind)
  })
})

describe("canRetry", () => {
  it("is offered for transient-looking failures only", () => {
    expect(canRetry("network")).toBe(true)
    expect(canRetry("unknown")).toBe(true)
    expect(canRetry("forbidden")).toBe(false)
    expect(canRetry("storage")).toBe(false)
  })
})
