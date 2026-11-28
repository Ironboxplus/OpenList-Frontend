import { describe, expect, it } from "vitest"

// The page's base layer (app/base.css) is what hope-ui's reset and the app's
// global styles gave every element: border-box, no borders or margins, block
// media, the system font. Written out rule by rule from hope-ui 0.6.8's
// global reset (dist/index.mjs 2306-2362) and the old app/theme.ts
// globalStyles; the parser below reads `selector { declarations }` blocks.
const files = import.meta.glob("../*.css", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>
const css = files["../base.css"] ?? ""
const app = (
  Object.values(
    import.meta.glob("../App.tsx", {
      query: "?raw",
      import: "default",
      eager: true,
    }),
  ) as string[]
)[0]

const rules = () => {
  const out: Record<string, Record<string, string>> = {}
  const plain = css.replace(/\/\*[\s\S]*?\*\//g, "")
  for (const m of plain.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const sel = m[1].trim().replace(/\s+/g, " ")
    out[sel] ??= {}
    for (const d of m[2].split(";")) {
      const i = d.indexOf(":")
      if (i > 0) out[sel][d.slice(0, i).trim()] = d.slice(i + 1).trim()
    }
  }
  return out
}

describe("base.css", () => {
  it("exists and the app loads it", () => {
    expect(css.length).toBeGreaterThan(200)
    expect(app).toContain('import "./base.css"')
  })

  it("makes every box border-box with no border and no margin", () => {
    const r = rules()
    expect(r["*, ::before, ::after"]).toMatchObject({
      "box-sizing": "border-box",
      "border-width": "0",
      "border-style": "solid",
    })
    expect(r["*"]).toMatchObject({ margin: "0", padding: "0" })
  })

  it("sizes the page and sets its type", () => {
    const r = rules()
    expect(r["html, body"]).toMatchObject({ height: "100%" })
    expect(r.html).toMatchObject({ "font-size": "16px", "line-height": "1.5" })
    expect(r.html["font-family"]).toMatch(/^-apple-system,/)
    expect(r.html["font-family"]).not.toContain("!important")
    expect(r.body).toMatchObject({
      "background-color": "var(--canvas)",
      color: "var(--foreground)",
      "font-family": "inherit",
      "line-height": "inherit",
    })
  })

  it("resets headings, media, form controls, links and lists", () => {
    const r = rules()
    expect(r["h1, h2, h3, h4, h5, h6"]).toMatchObject({
      "font-size": "inherit",
      "font-weight": "inherit",
    })
    expect(r["p, h1, h2, h3, h4, h5, h6"]).toMatchObject({
      "overflow-wrap": "break-word",
    })
    expect(r["img, picture, video, canvas, svg"]).toMatchObject({
      display: "block",
      "max-width": "100%",
    })
    expect(r["button, input, textarea, select, optgroup"]).toMatchObject({
      "font-family": "inherit",
      "font-size": "100%",
    })
    expect(r.a).toMatchObject({
      "background-color": "transparent",
      color: "inherit",
      "text-decoration": "inherit",
    })
    expect(r["ol, ul"]).toMatchObject({ margin: "0", padding: "0" })
  })

  it("keeps the root column and the rubber-band selection", () => {
    const r = rules()
    expect(r["#root"]).toMatchObject({
      display: "flex",
      "flex-direction": "column",
      "align-items": "center",
    })
    expect(r[".viselect-selection-area"]).toMatchObject({
      border: "2px solid rgba(98, 155, 255, 0.81)",
    })
    expect(r[".viselect-container"]).toMatchObject({ "user-select": "none" })
    expect(r[".viselect-container .viselect-item"]).toMatchObject({
      "-webkit-user-drag": "none",
    })
    expect(r[".viselect-container .viselect-item img"]).toMatchObject({
      "-webkit-user-drag": "none",
    })
  })
})
