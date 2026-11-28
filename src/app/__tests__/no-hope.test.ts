import { describe, expect, it } from "vitest"

// hope-ui leaves src batch by batch (PLAN_FE_SYSTEM_UX_1127 P5). GONE lists
// where it is gone; each batch adds its part and B6 makes it the whole of src.
const GONE: RegExp[] = [
  // B1: the colour mode is ours (store/color-mode.ts)
  /^app\/App\.tsx$/,
  /^components\/(EChart|SwitchColorMode)\.tsx$/,
  /^features\//,
  /^pages\/media\//,
  /^pages\/login\/index\.tsx$/,
  /^store\//,
  /^utils\//,
  // B2: components/, but for the overlay compat layer (its parts take hope's
  // style props until the pages that pass them are converted: end of B5)
  /^components\/(?!overlay\/)/,
  // B3: manage (the six upstream pages included: docs/FE_UPSTREAM_DIVERGENCE.md),
  // init, the rest of login, the built-in plugins, the test page
  /^pages\/manage\/(?!__tests__\/)/,
  /^pages\/(init|login|test)\//,
  /^plugins\//,
  // B4: the toolbar and the upload dialogs
  /^pages\/home\/(toolbar|uploads)\//,
]

// app/ColorSchemeSync.tsx hands the store's mode to hope's provider until B6
const BRIDGE = "app/ColorSchemeSync.tsx"
const SELF = "app/__tests__/no-hope.test.ts"

// The glob keys are relative to this file and Vite shortens them for the files
// beside it ("../App.tsx" for app/App.tsx), so each is resolved to its path
// under src/ before the lists above are matched against it.
const raw = (glob: Record<string, unknown>) =>
  Object.entries(glob as Record<string, string>).map(([key, src]) => ({
    path: new URL(key, import.meta.url).pathname.replace(/^.*\/src\//, ""),
    src,
  }))
const sources = raw(
  import.meta.glob("../../**/*.{ts,tsx}", {
    query: "?raw",
    import: "default",
    eager: true,
  }),
).filter((f) => f.path !== SELF)
const styles = raw(
  import.meta.glob("../../**/*.css", {
    query: "?raw",
    import: "default",
    eager: true,
  }),
)

describe("hope-ui leaving src (P5)", () => {
  it("scans the sources and the styles", () => {
    expect(sources.length).toBeGreaterThan(400)
    expect(styles.length).toBeGreaterThan(5)
    // the paths the lists name are the ones the scan has
    const paths = sources.map((f) => f.path)
    expect(paths).toContain("app/App.tsx")
    expect(paths).toContain(BRIDGE)
    expect(paths).toContain("store/color-mode.ts")
    expect(paths).not.toContain(SELF)
  })

  it("is not imported where it is gone", () => {
    const offenders = sources
      .filter((f) => GONE.some((re) => re.test(f.path)))
      .filter((f) => f.src.includes("@hope-ui/solid"))
      .map((f) => f.path)
    expect(offenders).toEqual([])
  })

  it("takes the colour mode from the store only", () => {
    const hook =
      /import\s*\{[^}]*\buseColorMode(Value)?\b[^}]*\}\s*from\s*"@hope-ui\/solid"/
    const offenders = sources
      .filter((f) => f.path !== BRIDGE && hook.test(f.src))
      .map((f) => f.path)
    expect(offenders).toEqual([])
  })

  it("keys no style on hope's body class or colours", () => {
    const offenders = styles
      .filter((f) => /hope-ui-(dark|light)|--hope-colors-/.test(f.src))
      .map((f) => f.path)
    expect(offenders).toEqual([])
  })
})
