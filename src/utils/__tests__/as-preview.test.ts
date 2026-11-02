import { describe, expect, it } from "vitest"
import { setBasePath } from "../config"
import { asPreview } from "../share"

describe("asPreview", () => {
  it("marks share links", () => {
    expect(asPreview("http://h/sd/s/v.mkv")).toBe(
      "http://h/sd/s/v.mkv?preview=1",
    )
    expect(asPreview("http://h/sd/s/v.mkv?auth=t")).toBe(
      "http://h/sd/s/v.mkv?auth=t&preview=1",
    )
    expect(asPreview("http://h/sad/s/a.zip?inner=%2Fx#frag")).toBe(
      "http://h/sad/s/a.zip?inner=%2Fx&preview=1#frag",
    )
  })
  it("looks past the site base path", () => {
    setBasePath("/base")
    expect(asPreview("http://h/base/sd/s/v.mkv")).toBe(
      "http://h/base/sd/s/v.mkv?preview=1",
    )
    expect(asPreview("http://h/base/d/sd/v.mkv")).toBe(
      "http://h/base/d/sd/v.mkv",
    )
    setBasePath("")
  })
  it("marks a link once", () => {
    expect(asPreview("http://h/sd/s/v.mkv?preview=1&auth=t")).toBe(
      "http://h/sd/s/v.mkv?preview=1&auth=t",
    )
    expect(asPreview("http://h/sd/s/v.mkv?auth=t&preview=1")).toBe(
      "http://h/sd/s/v.mkv?auth=t&preview=1",
    )
  })
  it("leaves other links alone", () => {
    expect(asPreview("")).toBe("")
    expect(asPreview("http://h/d/movies/v.mkv?sign=x")).toBe(
      "http://h/d/movies/v.mkv?sign=x",
    )
    // a folder that merely contains /sd/ is not a share link
    expect(asPreview("http://h/p/sd/v.mkv")).toBe("http://h/p/sd/v.mkv")
    expect(asPreview("http://h/d/sd/v.mkv?sign=x")).toBe(
      "http://h/d/sd/v.mkv?sign=x",
    )
    expect(asPreview("/sd/s/v.mkv")).toBe("/sd/s/v.mkv?preview=1")
  })
})
