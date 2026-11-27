import { render } from "@solidjs/testing-library"
import { describe, expect, it, vi } from "vitest"

const seen: any[] = []

vi.mock("../movi_core", () => ({
  MoviCore: (p: any) => {
    seen.push(p)
    return <div data-testid="core" />
  },
}))
vi.mock("~/hooks", () => ({
  useRouter: () => ({ pathname: () => "/movies" }),
}))
vi.mock("~/store", () => ({
  viewerPath: () => "/movies/a.mkv",
  objStore: {
    obj: { name: "a.mkv" },
    raw_url: "http://x/raw/a.mkv",
    provider: "115 Open",
  },
}))

import Preview from "../movi_video"

describe("movi as a preview", () => {
  it("hands MoviCore the open file's path, raw url and provider", () => {
    render(() => <Preview />)
    const p = seen[seen.length - 1]
    expect(p.path).toBe("/movies/a.mkv")
    expect(p.rawUrl).toBe("http://x/raw/a.mkv")
    expect(p.provider).toBe("115 Open")
    // the media overlay's hooks stay unused here
    expect(p.startAt).toBeUndefined()
    expect(p.autoplay).toBeUndefined()
    expect(p.onPlayer).toBeUndefined()
  })
})
