import { describe, expect, it } from "vitest"
import { isSafeRedirect, loginUrlFor, resolveRedirect } from "../redirect"

describe("isSafeRedirect", () => {
  const safe = ["/", "/a", "/a/b?type=copy", "/a?x=1#h", "/@manage/settings/site", "/dir%20name/f.txt"]
  const unsafe: [string, unknown][] = [
    ["empty", ""],
    ["undefined", undefined],
    ["number", 5],
    ["relative", "a/b"],
    ["protocol relative", "//evil.com"],
    ["protocol relative with path", "//evil.com/x"],
    ["backslash host", "/\\evil.com"],
    ["backslash anywhere", "/a\\b"],
    ["absolute http", "http://evil.com"],
    ["absolute https", "https://evil.com/x"],
    ["javascript scheme", "javascript:alert(1)"],
    ["data scheme", "data:text/html,x"],
    ["tab smuggling", "/\t/evil.com"],
    ["newline smuggling", "/\n/evil.com"],
    ["nul", "/a\u0000"],
  ]
  it.each(safe)("accepts %s", (v) => expect(isSafeRedirect(v)).toBe(true))
  it.each(unsafe)("rejects %s", (_n, v) => expect(isSafeRedirect(v)).toBe(false))
})

describe("resolveRedirect", () => {
  it("passes safe values through untouched, query and hash included", () => {
    expect(resolveRedirect("/a/b?type=copy&x=1#frag")).toBe("/a/b?type=copy&x=1#frag")
  })
  it("falls back to / (or the given fallback) for unsafe ones", () => {
    expect(resolveRedirect("//evil.com")).toBe("/")
    expect(resolveRedirect("https://evil.com", "/home")).toBe("/home")
    expect(resolveRedirect(undefined)).toBe("/")
  })
  it("never redirects back to the login page", () => {
    expect(resolveRedirect("/@login")).toBe("/")
    expect(resolveRedirect("/@login?redirect=%2Fx")).toBe("/")
    expect(resolveRedirect("/@loginx")).toBe("/@loginx")
  })
})

describe("loginUrlFor", () => {
  it("keeps pathname, search and hash and round-trips", () => {
    const url = loginUrlFor({ pathname: "/a b/c", search: "?type=copy&q=1%202", hash: "#h" })
    const redirect = new URL(url, "http://x").searchParams.get("redirect")
    expect(redirect).toBe("/a b/c?type=copy&q=1%202#h")
    expect(resolveRedirect(redirect)).toBe(redirect)
  })
})
