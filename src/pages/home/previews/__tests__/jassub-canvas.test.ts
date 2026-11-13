import { describe, it, expect } from "vitest"
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

// The JASSUB worker that is bundled (movi-jassub.ts imports it as is) draws the
// subtitles over movi's video canvas. A context it creates with
// `desynchronized: true` is a low-latency canvas, which the browser may hand to
// the display as a layer of its own: on phones the video under the subtitles
// then showed black while the sound and the subtitles went on. JASSUB has no
// option for it (https://github.com/ThaUnknown/jassub/issues/70), so the
// package is patched (patches/jassub@2.5.37.patch).
describe("JASSUB worker canvases", () => {
  const dir = join(process.cwd(), "node_modules/jassub/dist/worker/renderers")
  const renderers = readdirSync(dir).filter((f) => f.endsWith(".js"))

  it("are composited with the page, never desynchronized", () => {
    expect(renderers).toEqual(
      expect.arrayContaining([
        "2d-renderer.js",
        "webgl1-renderer.js",
        "webgl2-renderer.js",
      ]),
    )
    const asking = renderers.filter((f) =>
      /desynchronized:\s*true/.test(readFileSync(join(dir, f), "utf8")),
    )
    expect(asking).toEqual([])
  })
})
