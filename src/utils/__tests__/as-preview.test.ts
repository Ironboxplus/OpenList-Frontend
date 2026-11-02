import { describe, expect, it } from "vitest"
import { asPreview } from "../share"

describe("asPreview", () => {
  it("marks share links", () => {
    expect(asPreview("http://h/sd/s/v.mkv")).toBe(
      "http://h/sd/s/v.mkv?preview=1",
    )
    expect(asPreview("http://h/sd/s/v.mkv?auth=t")).toBe(
      "http://h/sd/s/v.mkv?auth=t&preview=1",
    )
    expect(asPreview("http://h/base/sad/s/a.zip?inner=%2Fx#frag")).toBe(
      "http://h/base/sad/s/a.zip?inner=%2Fx&preview=1#frag",
    )
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
    expect(asPreview("http://h/p/sd/v.mkv")).toBe(
      "http://h/p/sd/v.mkv?preview=1",
    )
  })
})
