import { render } from "@solidjs/testing-library"
import { describe, expect, it } from "vitest"
import { PosterMosaic } from "../GridBadges"

const urls = (n: number) => Array.from({ length: n }, (_, i) => `/p${i}.png`)

describe("PosterMosaic", () => {
  it.each([
    [1, 1],
    [2, 2],
    [3, 3],
    [4, 4],
    [6, 4],
  ])("%i posters draw %i cells", (n, cells) => {
    const v = render(() => <PosterMosaic urls={urls(n)} />)
    expect(v.container.querySelectorAll("img").length).toBe(cells)
  })

  it("one poster fills the card, three make a tall one plus two", () => {
    const one = render(() => <PosterMosaic urls={urls(1)} />)
    expect(one.container.querySelector(".grid-cols-1")).not.toBeNull()
    const three = render(() => <PosterMosaic urls={urls(3)} />)
    expect(three.container.querySelectorAll(".row-span-2").length).toBe(1)
  })
})
