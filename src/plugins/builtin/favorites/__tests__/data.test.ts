import { describe, expect, it } from "vitest"
import { isFavorited, sortFavorites, type Favorite } from "../data"

const fav = (over: Partial<Favorite>): Favorite => ({
  id: 1,
  path: "/a",
  name: "a",
  is_dir: false,
  tag: "",
  created_at: 0,
  ...over,
})

describe("isFavorited", () => {
  it("returns true when a favorite with the path exists", () => {
    const list = [fav({ path: "/a" }), fav({ path: "/b" })]
    expect(isFavorited(list, "/b")).toBe(true)
  })

  it("returns false when no favorite matches the path", () => {
    const list = [fav({ path: "/a" })]
    expect(isFavorited(list, "/missing")).toBe(false)
  })

  it("returns false for an empty list", () => {
    expect(isFavorited([], "/a")).toBe(false)
  })
})

describe("sortFavorites", () => {
  it("puts directories before files", () => {
    const list = [
      fav({ name: "file", is_dir: false }),
      fav({ name: "dir", is_dir: true }),
    ]
    const sorted = sortFavorites(list)
    expect(sorted.map((f) => f.name)).toEqual(["dir", "file"])
  })

  it("sorts within a group by name, case-insensitively", () => {
    const list = [
      fav({ name: "Banana", is_dir: false }),
      fav({ name: "apple", is_dir: false }),
    ]
    const sorted = sortFavorites(list)
    expect(sorted.map((f) => f.name)).toEqual(["apple", "Banana"])
  })

  it("does not mutate the input array", () => {
    const list = [fav({ name: "b" }), fav({ name: "a" })]
    const copy = [...list]
    sortFavorites(list)
    expect(list).toEqual(copy)
  })
})
