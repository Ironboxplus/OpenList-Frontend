import { describe, expect, it } from "vitest"

// hope-ui is gone from the app (PLAN_FE_SYSTEM_UX_1127 P5, B6): no source
// imports it, no style or script keys on its body class or colour variables,
// the package is not a dependency, and the colour mode is the store's.
const SELF = "app/__tests__/no-hope.test.ts"

// The glob keys are relative to this file and Vite shortens them for the files
// beside it ("../App.tsx" for app/App.tsx), so each is resolved to its path
// under src/.
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
const manifest = (
  Object.values(
    import.meta.glob("../../../package.json", {
      query: "?raw",
      import: "default",
      eager: true,
    }),
  ) as string[]
)[0]
const vitestConfig = (
  Object.values(
    import.meta.glob("../../../vitest.config.ts", {
      query: "?raw",
      import: "default",
      eager: true,
    }),
  ) as string[]
)[0]

describe("hope-ui leaving src (P5)", () => {
  it("scans the sources, the styles and the manifest", () => {
    expect(sources.length).toBeGreaterThan(400)
    expect(styles.length).toBeGreaterThan(5)
    const paths = sources.map((f) => f.path)
    expect(paths).toContain("app/App.tsx")
    expect(paths).toContain("app/ColorSchemeSync.tsx")
    expect(paths).toContain("store/color-mode.ts")
    expect(paths).not.toContain(SELF)
    expect(JSON.parse(manifest).name).toBeTruthy()
    expect(vitestConfig).toContain("defineConfig")
  })

  it("is imported by no source", () => {
    const offenders = sources
      .filter((f) => /["']@hope-ui\//.test(f.src))
      .map((f) => f.path)
    expect(offenders).toEqual([])
  })

  it("has no theme of its own any more", () => {
    expect(sources.map((f) => f.path)).not.toContain("app/theme.ts")
  })

  it("is not a dependency, and tests do not inline it", () => {
    const pkg = JSON.parse(manifest)
    const deps = { ...pkg.dependencies, ...pkg.devDependencies }
    expect(Object.keys(deps).filter((n) => n.includes("hope-ui"))).toEqual([])
    expect(vitestConfig).not.toContain("hope")
  })

  it("keys no style or script on hope's body class or colours", () => {
    const key = /hope-ui-(dark|light)|--hope-colors-/
    const offenders = [...sources, ...styles]
      .filter((f) => key.test(f.src))
      .map((f) => f.path)
    expect(offenders).toEqual([])
  })
})
