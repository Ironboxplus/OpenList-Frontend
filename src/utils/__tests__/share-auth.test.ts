import { afterEach, describe, expect, it } from "vitest"
import {
  bodyPath,
  clearShareToken,
  getShareToken,
  setShareToken,
  shareIdOf,
  withShareToken,
} from "../share-auth"

afterEach(() => localStorage.clear())

describe("shareIdOf", () => {
  it("reads the id of a share path", () => {
    expect(shareIdOf("/@s/abc")).toBe("abc")
    expect(shareIdOf("/@s/abc/dir/f.mkv")).toBe("abc")
    expect(shareIdOf("/@s/分享-1/x")).toBe("分享-1")
  })
  it("is empty for other paths", () => {
    expect(shareIdOf("/")).toBe("")
    expect(shareIdOf("/@s")).toBe("")
    expect(shareIdOf("/@sx/abc")).toBe("")
    expect(shareIdOf("/movies/@s/abc")).toBe("")
  })
})

describe("tokens", () => {
  it("are kept per share", () => {
    setShareToken("a", "tok-a")
    setShareToken("b", "tok-b")
    expect(getShareToken("a")).toBe("tok-a")
    expect(getShareToken("b")).toBe("tok-b")
    clearShareToken("a")
    expect(getShareToken("a")).toBe("")
    expect(getShareToken("b")).toBe("tok-b")
  })
  it("expire", () => {
    localStorage.setItem(
      "share-token:a",
      JSON.stringify({ token: "old", exp: Date.now() - 1 }),
    )
    expect(getShareToken("a")).toBe("")
    expect(localStorage.getItem("share-token:a")).toBeNull()
  })
  it("survive damaged storage", () => {
    localStorage.setItem("share-token:a", "{not json")
    expect(getShareToken("a")).toBe("")
  })
})

describe("withShareToken", () => {
  it("adds the token with the right separator and escaping", () => {
    setShareToken("a", "x+y/z=&")
    const enc = encodeURIComponent("x+y/z=&")
    expect(withShareToken("http://h/sd/a/f", "a")).toBe(
      `http://h/sd/a/f?auth=${enc}`,
    )
    expect(withShareToken("http://h/sd/a/f?preview=1", "a")).toBe(
      `http://h/sd/a/f?preview=1&auth=${enc}`,
    )
  })
  it("leaves the url alone without a token", () => {
    expect(withShareToken("http://h/sd/a/f", "a")).toBe("http://h/sd/a/f")
  })
})

describe("bodyPath", () => {
  it("reads an object or a JSON string", () => {
    expect(bodyPath({ path: "/@s/a" })).toBe("/@s/a")
    expect(bodyPath('{"path":"/@s/a"}')).toBe("/@s/a")
  })
  it("is empty otherwise", () => {
    expect(bodyPath(undefined)).toBe("")
    expect(bodyPath("not json")).toBe("")
    expect(bodyPath(new FormData())).toBe("")
  })
})
