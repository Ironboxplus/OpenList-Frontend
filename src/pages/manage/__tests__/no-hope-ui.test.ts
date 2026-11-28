import { describe, expect, it } from "vitest"

// The manage area is on the shared components, the upstream plugin and seed
// pages included (docs/FE_UPSTREAM_DIVERGENCE.md): no page is exempt.
const files = import.meta.glob("../**/*.{ts,tsx}", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>

const usesHope = (src: string) => src.includes("@hope-ui/solid")
const rel = (path: string) => path.replace(/^\.\.\//, "")

describe("hope-ui in pages/manage", () => {
  const pages = Object.entries(files)
    .map(([path, src]) => ({ path: rel(path), src }))
    // Tests live next to this file (./...); only the pages are checked.
    .filter((f) => !f.path.startsWith("./"))

  it("scans the page sources", () => {
    expect(pages.length).toBeGreaterThan(40)
  })

  it("is imported by no page", () => {
    const offenders = pages.filter((f) => usesHope(f.src)).map((f) => f.path)
    expect(offenders).toEqual([])
  })
})
