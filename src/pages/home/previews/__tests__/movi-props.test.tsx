import { render } from "@solidjs/testing-library"
import { describe, expect, it, vi } from "vitest"
import { type JSX } from "solid-js"

const seen: any[] = []
const navigate = vi.fn()

vi.mock("../movi_core", () => ({
  MoviCore: (p: any) => {
    seen.push(p)
    return <div data-testid="core" />
  },
}))
vi.mock("../video_box", () => ({
  VideoBox: (p: { children: JSX.Element; onAutoNextChange: any }) => (
    <div>{p.children}</div>
  ),
}))
vi.mock("@solidjs/router", () => ({ useNavigate: () => navigate }))
vi.mock("~/hooks", () => ({
  useRouter: () => ({ pathname: () => "/movies/a.mkv" }),
}))
vi.mock("~/store", () => ({
  objStore: {
    obj: { name: "a.mkv" },
    objs: [
      { name: "a.mkv", type: 2 },
      { name: "b.mkv", type: 2 },
      { name: "c.txt", type: 4 },
    ],
    raw_url: "http://x/raw/a.mkv",
    provider: "115 Open",
  },
}))

import Preview from "../movi_video"

describe("file page movi preview", () => {
  it("hands MoviCore the file page's path, raw url and provider", () => {
    render(() => <Preview />)
    const p = seen[seen.length - 1]
    expect(p.path).toBe("/movies/a.mkv")
    expect(p.rawUrl).toBe("http://x/raw/a.mkv")
    expect(p.provider).toBe("115 Open")
    expect(p.autoNext).toBe(false)
    // the media overlay's hooks stay unused here
    expect(p.startAt).toBeUndefined()
    expect(p.autoplay).toBeUndefined()
    expect(p.onPlayer).toBeUndefined()
  })

  it("goes to the next video of the folder", () => {
    render(() => <Preview />)
    seen[seen.length - 1].onNext()
    expect(String(navigate.mock.calls[0][0])).toMatch(/b.mkv$/)
  })
})
