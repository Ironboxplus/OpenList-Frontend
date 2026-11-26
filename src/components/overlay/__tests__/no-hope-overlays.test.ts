import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

// Every overlay comes from ~/components/overlay (or the kit), so menus,
// dialogs and tooltips share Kobalte's one layer stack and focus scope
// (PLAN_FE_UNIFY_OVERLAYS_1126 §3). hope-ui's own are not imported again.
const OVERLAY =
  /^(Modal\w*|Drawer\w*|Menu\w*|Popover\w*|Tooltip|createDisclosure)$/

const sources = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) return e.name === "__tests__" ? [] : sources(p)
    return /\.(tsx?|jsx?)$/.test(e.name) ? [p] : []
  })

describe("hope-ui overlays", () => {
  it("are imported from ~/components/overlay, not from @hope-ui/solid", () => {
    const src = path.resolve(process.cwd(), "src")
    const found: string[] = []
    for (const file of sources(src)) {
      const rel = path.relative(src, file).split(path.sep).join("/")
      if (/^components\/(ui|overlay)\//.test(rel)) continue
      const text = fs.readFileSync(file, "utf8")
      for (const m of text.matchAll(
        /import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*"@hope-ui\/solid"/g,
      )) {
        const names = m[1]
          .split(",")
          .map(
            (x) =>
              x
                .trim()
                .replace(/^type\s+/, "")
                .split(/\s+as\s+/)[0],
          )
          .filter((x) => OVERLAY.test(x))
        if (names.length) found.push(`${rel}: ${names.join(" ")}`)
      }
    }
    expect(found).toEqual([])
  })
})
