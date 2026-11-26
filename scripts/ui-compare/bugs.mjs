// Specs for the four reported shell bugs (docs/PLAN_FE_SHELL_FIXES_1126.md), run
// in a real browser against a real OpenList (see .github/workflows/ui-compare.yml).
// A failing spec exits 1. When a page stops answering, the spec pauses the
// renderer through the debugger protocol and prints where it was (source maps
// resolve the frames), so the cause is read, not guessed.
// usage: node bugs.mjs <out dir>   env: OL_PASS
import { chromium } from "playwright"
import { SourceMapConsumer } from "source-map"
import fs from "node:fs"
import path from "node:path"
import { alive, log, MOUNT, OL, seed } from "./lib.mjs"

const out = process.argv[2]
fs.mkdirSync(out, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const browser = await chromium.launch()
const { token } = await seed(out)

const results = []
async function spec(name, opts, fn) {
  const { width = 1440, height = 900, theme = "light" } = opts
  const id = `${name}.${width}.${theme}`
  const ctx = await browser.newContext({ viewport: { width, height }, locale: "zh-CN", colorScheme: theme })
  await ctx.addInitScript((t) => localStorage.setItem("token", t), token)
  // every focus() call is counted with its target: two focus handlers pulling
  // against each other show up as thousands of calls on two elements
  await ctx.addInitScript(() => {
    const calls = (window.__focusCalls = { n: 0, by: {} })
    const orig = HTMLElement.prototype.focus
    HTMLElement.prototype.focus = function (...a) {
      if (calls.n++ < 100000) {
        const k = `${this.tagName.toLowerCase()}[${this.getAttribute("role") || ""}]${this.id ? "#" + this.id.replace(/d+/g, "N") : ""}`
        calls.by[k] = (calls.by[k] || 0) + 1
      }
      return orig.apply(this, a)
    }
  })
  const page = await ctx.newPage()
  page.setDefaultTimeout(8000)
  const errors = []
  page.on("pageerror", (e) => errors.push(String(e?.message || e).split("\n")[0]))
  // armed before anything runs: a hung page cannot be attached to afterwards
  const cdp = await ctx.newCDPSession(page)
  const scripts = new Map()
  cdp.on("Debugger.scriptParsed", (e) => scripts.set(e.scriptId, e.url))
  await cdp.send("Debugger.enable")
  const env = { page, ctx, cdp, scripts, errors, id }
  let message = ""
  try {
    await fn(env)
  } catch (e) {
    message = String(e?.message || e)
  }
  if (!(await alive(page))) {
    message = message || "page stopped answering"
  } else {
    await page.screenshot({ path: path.join(out, `${id}.png`) }).catch(() => {})
  }
  results.push({ id, ok: !message, message })
  log(message ? "FAIL" : "PASS", id, message.split("\n")[0])
  if (message) console.log(message)
  await Promise.race([ctx.close().catch(() => {}), sleep(5000)])
}

const go = async (page, p, wait = 900) => {
  await page.goto(OL + encodeURI(p), { waitUntil: "domcontentloaded" })
  await page.waitForLoadState("networkidle", { timeout: 6000 }).catch(() => {})
  await page.waitForTimeout(wait)
}

// ---- where a hung page is: pause it through CDP and read the frames
async function whereIs(cdp, scripts) {
  let frames
  cdp.on("Debugger.paused", (e) => (frames = e.callFrames))
  cdp.send("Debugger.pause").catch(() => {})
  for (let i = 0; i < 50 && !frames; i++) await sleep(100)
  if (!frames) return "the debugger could not pause the page"
  const calls = await cdp
    .send("Debugger.evaluateOnCallFrame", { callFrameId: frames[0].callFrameId, expression: "JSON.stringify(window.__focusCalls)" })
    .then((r) => r.result.value, () => "unavailable")
  log("focus calls at the freeze", calls)
  const maps = new Map()
  const lines = []
  for (const f of frames.slice(0, 40)) {
    const { lineNumber, columnNumber } = f.location
    const url = scripts.get(f.location.scriptId) ?? ""
    let where = `${url.split("/").pop()}:${lineNumber + 1}:${columnNumber}`
    if (url.startsWith(OL)) {
      if (!maps.has(url)) {
        maps.set(url, await fetch(url + ".map").then((r) => (r.ok ? r.json() : null)).then((j) => (j ? new SourceMapConsumer(j) : null)).catch(() => null))
      }
      const c = maps.get(url)
      const o = c?.originalPositionFor({ line: lineNumber + 1, column: columnNumber })
      if (o?.source) where = `${o.source.replace(/^.*\/src\//, "src/")}:${o.line} ${o.name ?? ""}`
    }
    lines.push(`  ${f.functionName || "(anonymous)"} ${where}`)
  }
  return lines.join("\n")
}

/** The dialog the action opened: visible within 2 s while the page keeps answering. */
async function expectDialog(env, label) {
  const { page, errors } = env
  const focus = async () =>
    JSON.stringify(
      await Promise.race([page.evaluate(() => window.__focusCalls), new Promise((r) => setTimeout(() => r("unavailable: page is frozen"), 1500))]),
    )
  const up = await page
    .locator('[role="dialog"], [role="alertdialog"]')
    .first()
    .waitFor({ state: "visible", timeout: 2000 })
    .then(() => true, () => false)
  if (!(await alive(page))) {
    throw new Error(`${label}: the page stopped answering. Stopped in:\n${await whereIs(env.cdp, env.scripts)}`)
  }
  log("focus calls", label, await focus())
  if (!up) throw new Error(`${label}: no dialog appeared within 2 s`)
  const overflow = errors.filter((e) => /call stack/i.test(e))
  if (overflow.length) throw new Error(`${label}: ${overflow.length}x "${overflow[0]}"`)
}
/** A click whose outcome is read from the page, not from the click: it may never return. */
const fire = (locator) => void locator.click().catch(() => {})
const item = (page, name) => page.locator(".viselect-item", { hasText: name }).first()

// ---- 1. a dialog opened from a menu must not freeze the page
await spec("share-from-context-menu", {}, async (env) => {
  await go(env.page, MOUNT)
  await item(env.page, "文档").click({ button: "right" })
  fire(env.page.locator('[role="menu"] [data-action="share"]'))
  await expectDialog(env, "share a folder from the context menu")
})
await spec("rename-from-context-menu", {}, async (env) => {
  await go(env.page, `${MOUNT}/文档`)
  await item(env.page, "笔记").click({ button: "right" })
  fire(env.page.locator('[role="menu"] [data-action="rename"]'))
  await expectDialog(env, "rename a file from the context menu")
})
await spec("copy-from-context-menu", {}, async (env) => {
  await go(env.page, `${MOUNT}/文档`)
  await item(env.page, "笔记").click({ button: "right" })
  fire(env.page.locator('[role="menu"] [data-action="copy"]'))
  await expectDialog(env, "copy a file from the context menu")
})
await spec("mkdir-from-new-menu", {}, async (env) => {
  await go(env.page, `${MOUNT}/文档`)
  await env.page.locator("[data-files-new]").click()
  fire(env.page.locator('[role="menuitem"][data-action="mkdir"]'))
  await expectDialog(env, "new folder from the New menu")
})

// ---- 2. the side tree scrolls sideways: every level is reachable and readable
const DEEP = Array.from({ length: 8 }, (_, i) => `第${i + 1}层-这是一个很长很长的目录名称用来测试左侧目录树的横向滚动-level${i + 1}`)
for (const theme of ["light", "dark"]) {
  await spec("nav-tree-deep-levels", { theme }, async (env) => {
    const { page } = env
    await go(page, `${MOUNT}/深层/${DEEP.join("/")}`, 1500)
    const row = page.locator('[role="treeitem"][aria-selected="true"] > div').first()
    await row.waitFor()
    const label = row.locator("span").last()
    // bring the row into view the way a user would: scroll every scrollable ancestor to its end
    const report = await label.evaluate((el) => {
      for (let a = el.parentElement; a; a = a.parentElement) {
        const o = getComputedStyle(a).overflowX
        if ((o === "auto" || o === "scroll") && a.scrollWidth > a.clientWidth) a.scrollLeft = a.scrollWidth
      }
      let clip = el.parentElement
      while (clip && getComputedStyle(clip).overflowX === "visible") clip = clip.parentElement
      const r = el.getBoundingClientRect()
      const c = clip.getBoundingClientRect()
      return {
        truncated: el.scrollWidth > el.clientWidth + 1,
        inside: r.left >= c.left - 1 && r.right <= c.right + 1,
        text: el.textContent,
        label: `${Math.round(r.left)}..${Math.round(r.right)} in ${Math.round(c.left)}..${Math.round(c.right)}`,
      }
    })
    await page.waitForTimeout(300)
    if (report.truncated) throw new Error(`the deepest level is cut with an ellipsis: "${report.text}"`)
    if (!report.inside) throw new Error(`the deepest level cannot be scrolled into view (${report.label})`)
  })
}

// ---- 3. a media item whose backdrop does not load must stay readable, with no empty block
await spec("media-header-without-backdrop", {}, async (env) => {
  const { page } = env
  await go(page, `${MOUNT}/媒体库/电影甲 (2020)`, 2500)
  const card = page.locator("[data-media-header]")
  await card.waitFor({ timeout: 6000 })
  const bad = await card.evaluate((root) => {
    const cv = document.createElement("canvas")
    cv.width = cv.height = 1
    const g = cv.getContext("2d", { willReadFrequently: true })
    const rgba = (css) => {
      g.clearRect(0, 0, 1, 1)
      g.fillStyle = "#000"
      g.fillStyle = css
      g.fillRect(0, 0, 1, 1)
      const d = g.getImageData(0, 0, 1, 1).data
      return [d[0], d[1], d[2], d[3] / 255]
    }
    const over = (t, u) => [0, 1, 2].map((i) => t[i] * t[3] + u[i] * (1 - t[3])).concat([1])
    const lum = (c) => {
      const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
      return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2])
    }
    const bgOf = (el) => {
      const st = []
      for (let e = el; e; e = e.parentElement) {
        const c = rgba(getComputedStyle(e).backgroundColor)
        if (c[3] > 0) st.push(c)
        if (c[3] >= 0.99) break
      }
      let a = [255, 255, 255, 1]
      for (let i = st.length - 1; i >= 0; i--) a = over(st[i], a)
      return a
    }
    const loaded = [...root.querySelectorAll("img")].filter((i) => i.complete && i.naturalWidth > 0)
    const failed = [...root.querySelectorAll("img")].filter((i) => !(i.complete && i.naturalWidth > 0))
    const out = { loadedImages: loaded.length, failedImages: failed.length, low: [] }
    for (const el of root.querySelectorAll("h1, span, p, button")) {
      if (!el.textContent.trim() || el.children.length > 0) continue
      const fg = over(rgba(getComputedStyle(el).color), bgOf(el))
      const hi = Math.max(lum(fg), lum(bgOf(el)))
      const lo = Math.min(lum(fg), lum(bgOf(el)))
      const ratio = (hi + 0.05) / (lo + 0.05)
      if (ratio < 3) out.low.push(`"${el.textContent.trim().slice(0, 20)}" ${ratio.toFixed(2)}:1`)
    }
    return out
  })
  if (bad.loadedImages) throw new Error("the seeded backdrop loaded; the spec needs one that fails")
  if (bad.low.length) throw new Error(`text of the media header cannot be read (${bad.failedImages} images failed): ${bad.low.join(", ")}`)
})
for (const view of ["library", "work"]) {
  await spec(`space-above-list-${view}`, {}, async (env) => {
    const { page } = env
    await go(page, view === "library" ? `${MOUNT}/媒体库` : `${MOUNT}/媒体库/剧集乙 (2021)/Season 1`, 2000)
    const m = await page.evaluate(() => {
      const bar = document.querySelector("[data-files-toolbar]")
      const first = document.querySelector(".viselect-item, .list-item, .list > .title")
      const card = document.querySelector("[data-shell-content]")
      const b = bar.getBoundingClientRect()
      const f = first.getBoundingClientRect()
      const c = card.getBoundingClientRect()
      return { gap: Math.round(f.top - b.bottom), inset: Math.round(f.left - c.left) }
    })
    if (m.gap > 90) throw new Error(`${m.gap}px between the breadcrumb bar and the first row`)
    if (m.inset > 60) throw new Error(`${m.inset}px between the content card and the first row`)
  })
}

// ---- 4. cards and frames have a visible edge
for (const theme of ["light", "dark"]) {
  await spec("card-edges", { theme }, async (env) => {
    const { page } = env
    await go(page, MOUNT, 1500)
    const rows = await page.evaluate(() => {
      const cv = document.createElement("canvas")
      cv.width = cv.height = 1
      const g = cv.getContext("2d", { willReadFrequently: true })
      const rgba = (css) => {
        g.clearRect(0, 0, 1, 1)
        g.fillStyle = "#000"
        g.fillStyle = css
        g.fillRect(0, 0, 1, 1)
        const d = g.getImageData(0, 0, 1, 1).data
        return [d[0], d[1], d[2], d[3] / 255]
      }
      const over = (t, u) => [0, 1, 2].map((i) => t[i] * t[3] + u[i] * (1 - t[3])).concat([1])
      const lum = (c) => {
        const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
        return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2])
      }
      const ratio = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05)
      const bgOf = (el) => {
        const st = []
        for (let e = el; e; e = e.parentElement) {
          const c = rgba(getComputedStyle(e).backgroundColor)
          if (c[3] > 0) st.push(c)
          if (c[3] >= 0.99) break
        }
        let a = [255, 255, 255, 1]
        for (let i = st.length - 1; i >= 0; i--) a = over(st[i], a)
        return a
      }
      // the README box has no marker of its own: it is the nearest shadowed ancestor of the markdown
      const readme = (() => {
        for (let e = document.querySelector(".markdown-body"); e; e = e.parentElement)
          if (getComputedStyle(e).boxShadow !== "none") return e
      })()
      const targets = {
        "content card": document.querySelector("[data-shell-content]"),
        "storage card": document.querySelector("[data-storage-card]"),
        "folder card": document.querySelector(".grid-item.grid-card.folder"),
        "file card": document.querySelector(".grid-item.grid-card:not(.folder)"),
        "readme card": readme,
      }
      return Object.entries(targets).map(([name, el]) => {
        if (!el) return { name, missing: true }
        const cs = getComputedStyle(el)
        const parent = bgOf(el.parentElement)
        const own = bgOf(el)
        const bw = Math.max(...["Top", "Right", "Bottom", "Left"].map((s) => parseFloat(cs[`border${s}Width`]) || 0))
        const border = bw > 0 ? ratio(over(rgba(cs.borderTopColor), own), parent) : 1
        return { name, edge: Math.max(border, ratio(own, parent)), border: +border.toFixed(2), fill: +ratio(own, parent).toFixed(2), bw }
      })
    })
    const weak = rows.filter((r) => r.missing || r.edge < 1.4)
    if (weak.length) throw new Error("no visible edge: " + weak.map((r) => (r.missing ? `${r.name} (not found)` : `${r.name} (border ${r.bw}px ${r.border}:1, fill ${r.fill}:1)`)).join("; "))
  })
}

fs.writeFileSync(path.join(out, "bugs.json"), JSON.stringify(results, null, 1))
await browser.close()
const failed = results.filter((r) => !r.ok)
log(`${results.length - failed.length}/${results.length} specs passed`)
process.exit(failed.length ? 1 : 0)
