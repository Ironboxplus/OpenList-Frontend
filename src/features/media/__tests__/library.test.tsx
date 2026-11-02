import { cleanup, render } from "@solidjs/testing-library"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("~/hooks", () => ({
  useT: () => (k: string, v?: Record<string, unknown>) =>
    v ? `${k}:${JSON.stringify(v)}` : k,
  useRouter: () => ({ pathname: () => "/lib" }),
}))
vi.mock("~/store", () => ({
  objStore: {
    objs: [
      { name: "a", is_dir: true },
      { name: "b", is_dir: true },
    ],
  },
  me: () => ({ role: 2 }),
}))
vi.mock("~/types", () => ({ UserMethods: { is_admin: () => true } }))
vi.mock("~/utils/config", () => ({ api: "" }))

import { LibraryBadge } from "../../files/LibraryMenuItem"
import { MediaHeader } from "../MediaHeader"
import { hasPosterView, isLibrary, posterActive, setMediaFor } from "../state"
import type { MediaFs } from "../types"

const lib = (children: MediaFs["children"] = []): MediaFs =>
  ({
    item: null,
    children,
    episodes: [],
    libraries: ["/lib"],
  }) as unknown as MediaFs

afterEach(() => {
  cleanup()
  setMediaFor("", undefined)
  localStorage.clear()
})

describe("video library", () => {
  it("opens as a poster wall by default, even with nothing identified", () => {
    setMediaFor("/lib", lib())
    expect(isLibrary()).toBe(true)
    expect(hasPosterView()).toBe(true)
    expect(posterActive()).toBe(true)
  })

  it("the saved per-directory choice still wins", () => {
    localStorage.setItem("media-view", JSON.stringify({ "/lib": "other" }))
    setMediaFor("/lib", lib())
    expect(posterActive()).toBe(false)
  })

  it("shows no header card, but a badge with N / M counts", () => {
    setMediaFor(
      "/lib",
      lib([{ path: "/lib/a", kind: "tv", title: "A" } as never]),
    )
    const h = render(() => <MediaHeader />)
    expect(h.container.querySelector("[data-media-header]")).toBeNull()
    cleanup()
    const b = render(() => <LibraryBadge />)
    const badge = b.container.querySelector("[data-library-badge]")!
    expect(badge.textContent).toContain("media.library.badge")
    expect(badge.textContent).toContain("1/2")
  })

  it("no badge in an ordinary folder", () => {
    setMediaFor("/lib", {
      item: { kind: "movie" },
      children: [],
      episodes: [],
      libraries: [],
    } as unknown as MediaFs)
    const b = render(() => <LibraryBadge />)
    expect(b.container.querySelector("[data-library-badge]")).toBeNull()
  })
})
