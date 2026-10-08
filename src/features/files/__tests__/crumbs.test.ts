import { describe, expect, it } from "vitest"
import { fileCrumbs, parentCrumb } from "../crumbs"

describe("fileCrumbs", () => {
  it("is just the root at /", () => {
    expect(fileCrumbs("/", false)).toEqual([
      { kind: "root", label: "", href: "/" },
    ])
  })

  it("builds cumulative hrefs", () => {
    const c = fileCrumbs("/a/b/c", false)
    expect(c.map((x) => x.href)).toEqual(["/", "/a", "/a/b", "/a/b/c"])
    expect(c.map((x) => x.label)).toEqual(["", "a", "b", "c"])
  })

  it("encodes characters that would break the URL", () => {
    const c = fileCrumbs("/my dir/100%/a#b?c", false)
    expect(c.at(-1)!.href).toBe("/my%20dir/100%25/a%23b%3Fc")
    expect(c.at(-1)!.label).toBe("a#b?c")
  })

  it("roots a share at /@s/<id>", () => {
    const c = fileCrumbs("/@s/abc/docs/x", true)
    expect(c[0]).toEqual({ kind: "share", label: "", href: "/@s/abc" })
    expect(c.map((x) => x.href)).toEqual([
      "/@s/abc",
      "/@s/abc/docs",
      "/@s/abc/docs/x",
    ])
  })

  it("tolerates a share without an id", () => {
    expect(fileCrumbs("/@s", true)[0].href).toBe("/@s/")
  })
})

describe("parentCrumb", () => {
  it("is the entry before the last, none at the root", () => {
    expect(parentCrumb(fileCrumbs("/a/b", false))?.href).toBe("/a")
    expect(parentCrumb(fileCrumbs("/a", false))?.href).toBe("/")
    expect(parentCrumb(fileCrumbs("/", false))).toBeUndefined()
  })
})
