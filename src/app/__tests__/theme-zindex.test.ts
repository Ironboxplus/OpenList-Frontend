import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { theme } from "../theme"

// The kit's overlays (components/ui) share one layer; whatever is still on
// hope and can open from inside one of them must be drawn above it. The
// toasts (toast.tsx) are the one layer above all of them.
const dir = path.resolve(process.cwd(), "src/components/ui")
const layersOf = (f: string) =>
  [
    ...fs.readFileSync(path.join(dir, f), "utf8").matchAll(/\bz-\[(\d+)\]/g),
  ].map((m) => Number(m[1]))
const kitLayer = () => {
  let max = 0
  for (const f of fs.readdirSync(dir))
    if (f.endsWith(".tsx") && f !== "toast.tsx")
      max = Math.max(max, ...layersOf(f))
  return max
}

describe("hope's z-index layers", () => {
  it("put hope's dropdowns, popovers and tooltips above the kit's dialogs, and the toasts above them all", () => {
    const kit = kitLayer()
    expect(kit).toBeGreaterThan(0)
    const [toasts] = layersOf("toast.tsx")
    for (const t of [theme.lightTheme, theme.darkTheme]) {
      const z = (t?.zIndices ?? {}) as Record<string, number>
      const under = ["dropdown", "popover", "tooltip"]
        .filter((layer) => !((z[layer] ?? 0) > kit))
        .map((layer) => `${layer} ${z[layer]} <= ${kit}`)
      expect(under).toEqual([])
      expect(toasts).toBeGreaterThan(z.tooltip)
    }
  })
})
