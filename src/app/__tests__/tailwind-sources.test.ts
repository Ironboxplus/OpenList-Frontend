import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

// Tailwind only writes the utilities it finds in the files it scans
// (tailwind.css has no automatic detection). A file styled with classes that
// is not on that list renders unstyled: hope-ui's style props are gone, so
// every source is styled by classes and every source must be scanned.
const rel = (key: string) =>
  new URL(key, import.meta.url).pathname.replace(/^.*\/src\//, "")

const css = fs.readFileSync(
  path.resolve(process.cwd(), "src/app/tailwind.css"),
  "utf8",
)

// `@source "dir"` and `@source not "dir"`, relative to app/
const entries = [
  ...css
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .matchAll(/@source\s+(not\s+)?"([^"]+)"/g),
].map((m) => ({
  not: !!m[1],
  path: path.posix.normalize(`app/${m[2]}`).replace(/^\.$/, ""),
}))
const covers = (e: { path: string }, file: string) =>
  e.path === "" || file === e.path || file.startsWith(`${e.path}/`)

const files = Object.keys(import.meta.glob("../../**/*.tsx"))
  .map(rel)
  .filter((f) => !f.includes("/__tests__/"))

describe("tailwind.css", () => {
  it("lists its sources", () => {
    expect(css).toContain("@import")
    expect(entries.filter((e) => !e.not).length).toBeGreaterThan(0)
    expect(files.length).toBeGreaterThan(300)
  })

  it("scans every component file", () => {
    const included = entries.filter((e) => !e.not)
    const excluded = entries.filter((e) => e.not)
    const unscanned = files.filter(
      (f) =>
        !included.some((e) => covers(e, f)) ||
        excluded.some((e) => covers(e, f)),
    )
    expect(unscanned).toEqual([])
  })
})
