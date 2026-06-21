import { describe, expect, it } from "vitest"
import { trimUserBase } from "../path"

describe("trimUserBase", () => {
  const base = "/storage/115/云下载"

  it("is a no-op for unrestricted users (empty or root base)", () => {
    expect(trimUserBase("/storage/115", "")).toBe("/storage/115")
    expect(trimUserBase("/storage/115", "/")).toBe("/storage/115")
    expect(trimUserBase("/anything", undefined)).toBe("/anything")
  })

  it("maps the base path itself to root", () => {
    expect(trimUserBase(base, base)).toBe("/")
  })

  it("strips the base prefix from a child path (the login-redirect case)", () => {
    expect(trimUserBase(`${base}/Shokugeki/ep01.mkv`, base)).toBe(
      "/Shokugeki/ep01.mkv",
    )
    expect(trimUserBase(`${base}/sub`, base)).toBe("/sub")
  })

  it("leaves an already-relative path unchanged", () => {
    expect(trimUserBase("/Shokugeki/ep01.mkv", base)).toBe(
      "/Shokugeki/ep01.mkv",
    )
  })

  it("does NOT strip a parent/sibling path that is not under base", () => {
    // A path above the user's root must not be silently turned into base —
    // it stays as-is and the backend resolves it under base (and 404s cleanly).
    expect(trimUserBase("/storage/115", base)).toBe("/storage/115")
    expect(trimUserBase("/storage/116/x", base)).toBe("/storage/116/x")
  })

  it("tolerates a trailing slash on the configured base", () => {
    expect(trimUserBase(`${base}/sub`, `${base}/`)).toBe("/sub")
  })

  it("does not partial-match a sibling that shares a prefix", () => {
    // base = /a, must NOT strip /ab/c
    expect(trimUserBase("/ab/c", "/a")).toBe("/ab/c")
  })
})
