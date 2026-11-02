import { beforeEach, describe, expect, it } from "vitest"
import { setMediaStatus } from "~/store/media"
import { resolveMediaCover } from "../media_cover"

beforeEach(() => setMediaStatus(null))

describe("resolveMediaCover", () => {
  it("uses the backend's cover_url as is when there is one", () => {
    expect(
      resolveMediaCover({
        cover: "thumb:/imgs/a.jpg",
        cover_url: "/api/public/media/cover?id=3&sign=abc",
      }),
    ).toBe("/api/public/media/cover?id=3&sign=abc")
  })

  it("falls back to composing the address from cover", () => {
    expect(resolveMediaCover({ cover: "data:image/png;base64,xx" })).toBe(
      "data:image/png;base64,xx",
    )
    expect(resolveMediaCover({ cover: "thumb:/imgs/a b.jpg" })).toContain(
      "/api/public/media/thumb?path=%2Fimgs%2Fa%20b.jpg",
    )
    expect(resolveMediaCover({ cover: "https://x.test/p.jpg" })).toBe(
      "https://x.test/p.jpg",
    )
  })

  it("goes through the proxy for remote covers when the server asks", () => {
    setMediaStatus({ proxy_cover: true })
    expect(resolveMediaCover({ cover: "https://x.test/p.jpg" })).toContain(
      "/api/public/media/proxy?url=https%3A%2F%2Fx.test%2Fp.jpg",
    )
  })

  it("is empty without a source", () => {
    expect(resolveMediaCover(undefined)).toBe("")
    expect(resolveMediaCover({})).toBe("")
  })
})
