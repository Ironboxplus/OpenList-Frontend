import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { theme } from "../theme"

// The kit's overlays (components/ui) are in two layers: the surfaces that
// cover the page (dialogs, sheets), and above them the toasts (toast.tsx);
// above both, what opens from a trigger (menus, popovers, lists, tooltips), so
// the menu someone has just opened is never under a toast. Whatever is still
// on hope and can open from inside one of them is drawn above them all.
const dir = path.resolve(process.cwd(), "src/components/ui")
const SURFACES = ["dialog.tsx", "sheet.tsx"]
const ANCHORED = [
  "combobox.tsx",
  "dropdown-menu.tsx",
  "popover.tsx",
  "select.tsx",
  "tooltip.tsx",
]
const layersOf = (f: string) =>
  [
    ...fs.readFileSync(path.join(dir, f), "utf8").matchAll(/\bz-\[(\d+)\]/g),
  ].map((m) => Number(m[1]))
const layered = () =>
  fs.readdirSync(dir).filter((f) => f.endsWith(".tsx") && layersOf(f).length)

describe("the overlays' layers", () => {
  it("knows the layer of every kit file that has one", () => {
    expect(layered().sort()).toEqual(
      [...SURFACES, ...ANCHORED, "toast.tsx"].sort(),
    )
  })

  it("draws the toasts over dialogs and sheets, and menus over the toasts", () => {
    const surfaces = Math.max(...SURFACES.flatMap(layersOf))
    const anchored = ANCHORED.flatMap(layersOf)
    const [toasts] = layersOf("toast.tsx")
    expect(toasts).toBeGreaterThan(surfaces)
    expect(Math.min(...anchored)).toBeGreaterThan(toasts)
  })

  it("puts hope's dropdowns, popovers and tooltips above all of the kit's", () => {
    const kit = Math.max(...layered().flatMap(layersOf))
    for (const t of [theme.lightTheme, theme.darkTheme]) {
      const z = (t?.zIndices ?? {}) as Record<string, number>
      const under = ["dropdown", "popover", "tooltip"]
        .filter((layer) => !((z[layer] ?? 0) > kit))
        .map((layer) => `${layer} ${z[layer]} <= ${kit}`)
      expect(under).toEqual([])
    }
  })
})
