import { describe, expect, it } from "vitest"

// The manage area is on the shared components; hope-ui stays only where a
// page is not ours to rewrite.
const EXEMPT = [
  // Upstream plugin pages: not rewritten, to keep merges with upstream clean.
  "plugins/AddPlugin.tsx",
  "plugins/ConfigPlugin.tsx",
  "plugins/Plugin.tsx",
  "plugins/index.tsx",
  // Used only by the upstream plugin page above.
  "common/DeletePopover.tsx",
  // Upstream transfer-seed settings page: same reason.
  "settings/Seed.tsx",
]

const files = import.meta.glob("../**/*.{ts,tsx}", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>

const usesHope = (src: string) => src.includes("@hope-ui/solid")
const rel = (path: string) => path.replace(/^\.\.\//, "")
const exempt = (path: string) => EXEMPT.includes(path)

describe("hope-ui in pages/manage", () => {
  const pages = Object.entries(files)
    .map(([path, src]) => ({ path: rel(path), src }))
    // Tests live next to this file (./...); only the pages are checked.
    .filter((f) => !f.path.startsWith("./"))

  it("scans the page sources", () => {
    expect(pages.length).toBeGreaterThan(40)
  })

  it("is imported only by the exempt pages", () => {
    const offenders = pages
      .filter((f) => usesHope(f.src) && !exempt(f.path))
      .map((f) => f.path)
    expect(offenders).toEqual([])
  })

  it("keeps no stale exemptions", () => {
    const stale = EXEMPT.filter(
      (p) => !pages.some((f) => f.path === p && usesHope(f.src)),
    )
    expect(stale).toEqual([])
  })
})
