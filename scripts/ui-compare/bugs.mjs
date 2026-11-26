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
import { alive, log, MOUNT, OL, row, seed, selectRows, tr } from "./lib.mjs"

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
const item = row
const PHONE = { width: 390, height: 844 }

// ---- 1. a dialog opened from a menu must not freeze the page: every menu
// that opens dialogs (right-click menu and its submenu, New, the top bar's
// More, the selection bar's More, the phone's More), entries picked by mouse
/** Opens a menu with `open`, picks the entry `open` returns, expects the dialog. */
const menuDialog = (name, opts, open) =>
  spec(name, opts, async (env) => {
    fire(await open(env.page))
    await expectDialog(env, name)
  })
const ctxEntry = async (page, dir, target, action) => {
  await go(page, dir)
  await item(page, target).click({ button: "right" })
  return page.locator(`[role="menu"] [data-action="${action}"]`)
}
await menuDialog("share-from-context-menu", {}, (p) => ctxEntry(p, MOUNT, "文档", "share"))
for (const action of ["rename", "copy", "move", "delete"]) {
  await menuDialog(`${action}-from-context-menu`, {}, (p) => ctxEntry(p, `${MOUNT}/文档`, "笔记", action))
}
// an entry of a submenu: More actions > Decompress
await menuDialog("decompress-from-context-submenu", {}, async (page) => {
  await go(page, `${MOUNT}/文档`)
  await item(page, "压缩包.zip").click({ button: "right" })
  await page.locator('[role="menu"]').getByRole("menuitem", { name: tr("files.more_actions") }).first().hover()
  const sub = page.locator('[role="menu"]').nth(1)
  await sub.waitFor()
  return sub.getByRole("menuitem", { name: tr("home.toolbar.decompress") }).first()
})
for (const action of ["mkdir", "new_file", "offline_download"]) {
  await menuDialog(`${action}-from-new-menu`, {}, async (page) => {
    await go(page, `${MOUNT}/文档`)
    await page.locator("[data-files-new]").click()
    return page.locator(`[role="menuitem"][data-action="${action}"]`)
  })
}
// the upload panel opens its file picker as it mounts: the deferred action
// must still carry the click's user activation, or the browser drops the picker
await spec("upload-from-new-menu", {}, async (env) => {
  const { page } = env
  await go(page, `${MOUNT}/文档`)
  const chooser = page.waitForEvent("filechooser", { timeout: 3000 }).then(() => true, () => false)
  await page.locator("[data-files-new]").click()
  fire(page.locator('[role="menuitem"][data-action="upload"]'))
  await expectDialog(env, "upload from the New menu")
  if (!(await chooser)) throw new Error("upload from the New menu: the file picker did not open")
})
for (const key of ["local_settings", "recursive_move", "remove_empty_directory"]) {
  await menuDialog(`${key}-from-more-menu`, {}, async (page) => {
    await go(page, `${MOUNT}/文档`)
    await page.locator("[data-files-more]").click()
    return page.getByRole("menuitem", { name: tr(`home.toolbar.${key}`) }).first()
  })
}
await menuDialog("decompress-from-selection-more", {}, async (page) => {
  await go(page, `${MOUNT}/文档`)
  await selectRows(page, "压缩包.zip", false)
  await page.locator('[data-action="batch-more"]').click()
  return page.getByRole("menuitem", { name: tr("home.toolbar.decompress") }).first()
})
for (const key of ["rename", "share"]) {
  await menuDialog(`${key}-from-phone-more`, PHONE, async (page) => {
    await go(page, `${MOUNT}/文档`)
    await selectRows(page, "笔记", true)
    await page.locator('[data-batch="more"]').click()
    return page.getByRole("menuitem", { name: tr(`home.toolbar.${key}`) }).first()
  })
}
await menuDialog("local_settings-from-phone-top-more", PHONE, async (page) => {
  await go(page, `${MOUNT}/文档`)
  await page.locator("[data-files-more]").click()
  return page.getByRole("menuitem", { name: tr("home.toolbar.local_settings") }).first()
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
    // The name is wider than the nav: it is read by scrolling sideways. Its end
    // must show with the tree scrolled fully right, its start fully left.
    // (Until 2026-11-26 this spec asked for the whole name inside the nearest
    // non-visible ancestor at once; that ancestor was the full-width Box inside
    // a max-content wrapper, which clipped nothing, so it passed vacuously.)
    const report = await label.evaluate((el) => {
      let box = el.parentElement
      while (box && !["auto", "scroll"].includes(getComputedStyle(box).overflowX)) box = box.parentElement
      const view = () => {
        const b = box.getBoundingClientRect()
        const left = b.left + box.clientLeft
        return [left, left + box.clientWidth]
      }
      const at = (x) => {
        box.scrollLeft = x
        const r = el.getBoundingClientRect()
        const [l, rr] = view()
        return { r, l, rr, s: `${Math.round(r.left)}..${Math.round(r.right)} in ${Math.round(l)}..${Math.round(rr)}` }
      }
      const end = at(box.scrollWidth)
      const start = at(0)
      return {
        truncated: el.scrollWidth > el.clientWidth + 1,
        text: el.textContent,
        endShown: end.r.right <= end.rr + 1 && end.r.right >= end.l,
        startShown: start.r.left >= start.l - 1 && start.r.left <= start.rr,
        end: end.s,
        start: start.s,
      }
    })
    log(`nav tree deepest ${theme}`, JSON.stringify(report))
    if (report.truncated) throw new Error(`the deepest level is cut with an ellipsis: "${report.text}"`)
    if (!report.endShown) throw new Error(`the end of the deepest name cannot be scrolled into view (${report.end})`)
    if (!report.startShown) throw new Error(`the start of the deepest name cannot be scrolled into view (${report.start})`)
  })
}
// m4 of the audit: after going to a deep folder its row is brought into view by
// itself, vertically only. scrollLeft stays as the user had it: 0 by default,
// and a sideways scroll the user made survives going to another folder.
// (A first version also scrolled sideways to the name; that hid the shallow
// rows, so the lead reversed it to vertical only on 2026-11-26.)
await spec("nav-tree-current-row-in-view", {}, async (env) => {
  const { page } = env
  await go(page, `${MOUNT}/深层/${DEEP.join("/")}`, 2000)
  const current = page.locator('nav[aria-label="main"] [role="treeitem"][aria-selected="true"] > div:first-child').first()
  await current.waitFor()
  const measure = () =>
    current.evaluate((rowEl) => {
      const box = rowEl.closest(".folder-tree-box")
      const b = box.getBoundingClientRect()
      const t = b.top + box.clientTop
      const bb = t + box.clientHeight
      const rowR = rowEl.getBoundingClientRect()
      return {
        text: rowEl.textContent,
        scrollLeft: box.scrollLeft,
        canScroll: box.scrollWidth - box.clientWidth,
        rowShown: rowR.top >= t - 1 && rowR.bottom <= bb + 1 && rowR.bottom <= innerHeight + 1,
        row: `${Math.round(rowR.top)}..${Math.round(rowR.bottom)} in ${Math.round(t)}..${Math.round(bb)}`,
      }
    })
  const deep = await measure()
  log("nav tree current row (deep url)", JSON.stringify(deep))
  if (!deep.text.includes("level8")) throw new Error(`the current row is "${deep.text}", not the deepest level`)
  if (!deep.rowShown) throw new Error(`the current folder's row is out of view vertically (${deep.row})`)
  if (deep.scrollLeft !== 0) throw new Error(`going deep scrolled the tree sideways: scrollLeft ${deep.scrollLeft}, default 0`)
  if (deep.canScroll < 40) throw new Error(`the tree does not scroll sideways (${deep.canScroll}px), the next check would prove nothing`)
  // the user scrolls sideways, then opens level 7 from the tree; el.click()
  // because Playwright's click would scroll the row into view itself. A
  // treeitem's first div is its row, the second its children's group (which
  // holds the deeper names too).
  const userLeft = 37
  await page.locator('nav[aria-label="main"] .folder-tree-box').evaluate((box, x) => (box.scrollLeft = x), userLeft)
  await page
    .locator('nav[aria-label="main"] [role="treeitem"] > div:first-child')
    .filter({ hasText: DEEP[6] })
    .first()
    .evaluate((el) => el.click())
  await page.waitForFunction(
    (name) => document.querySelector('nav[aria-label="main"] [role="treeitem"][aria-selected="true"] > div:first-child')?.textContent.includes(name),
    DEEP[6],
    { timeout: 6000 },
  )
  await page.waitForTimeout(500)
  const after = await measure()
  log("nav tree current row (after the user scrolled and opened level 7)", JSON.stringify(after))
  if (!after.rowShown) throw new Error(`the current folder's row is out of view vertically (${after.row})`)
  if (Math.abs(after.scrollLeft - userLeft) > 1)
    throw new Error(`opening a folder moved the user's sideways scroll: scrollLeft ${after.scrollLeft}, the user left ${userLeft}`)
})
// with the deep path open the tree is taller than the side nav: its last row
// must be reachable by scrolling down (a clipping wrapper cut it off, run 45808288515)
await spec("nav-tree-last-row-reachable", {}, async (env) => {
  const { page } = env
  await go(page, `${MOUNT}/深层/${DEEP.join("/")}`, 1500)
  await page.locator('[role="treeitem"][aria-selected="true"]').first().waitFor()
  const r = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('nav[aria-label="main"] [role="treeitem"] > div:first-child')]
    const last = rows[rows.length - 1]
    // the user's way: scroll every vertically scrollable ancestor to its end
    for (let a = last.parentElement; a; a = a.parentElement) {
      const o = getComputedStyle(a).overflowY
      if ((o === "auto" || o === "scroll") && a.scrollHeight > a.clientHeight) a.scrollTop = a.scrollHeight
    }
    const lr = last.getBoundingClientRect()
    const where = `${Math.round(lr.top)}..${Math.round(lr.bottom)}`
    for (let a = last.parentElement; a && a !== document.body; a = a.parentElement) {
      if (getComputedStyle(a).overflowY === "visible") continue
      const ar = a.getBoundingClientRect()
      if (lr.top < ar.top - 1 || lr.bottom > ar.bottom + 1)
        return { ok: false, rows: rows.length, text: last.textContent, why: `row at ${where} is cut by ${a.tagName.toLowerCase()}.${String(a.className).split(" ").slice(0, 3).join(".")} at ${Math.round(ar.top)}..${Math.round(ar.bottom)}` }
    }
    if (lr.bottom > innerHeight + 1) return { ok: false, rows: rows.length, text: last.textContent, why: `row at ${where} is below the window` }
    // and sideways at the default scroll position (scrollLeft untouched): the
    // row's name starts inside the tree box and the window
    const box = last.closest(".folder-tree-box")
    const b = box.getBoundingClientRect()
    const l = b.left + box.clientLeft
    const rr = Math.min(l + box.clientWidth, innerWidth)
    const name = last.querySelector(":scope > span:last-of-type").getBoundingClientRect()
    const across = `name ${Math.round(name.left)}..${Math.round(name.right)} in ${Math.round(l)}..${Math.round(rr)}, scrollLeft ${box.scrollLeft}`
    if (box.scrollLeft !== 0) return { ok: false, rows: rows.length, text: last.textContent, why: `the tree is not at the default scroll position (${across})` }
    if (name.left < l - 1 || name.left > rr - 24) return { ok: false, rows: rows.length, text: last.textContent, why: `the name does not start in view sideways (${across})` }
    return { ok: true, rows: rows.length, text: last.textContent, why: `${where}; ${across}` }
  })
  log("nav tree last row", JSON.stringify(r))
  if (!r.ok) throw new Error(`the last of ${r.rows} tree rows ("${r.text}") cannot be scrolled into view: ${r.why}`)
})
// the same tree in the copy / move dialog (FolderTree without the nav look):
// opened down to the deepest level, it scrolls inside the dialog, never widens it
for (const action of ["copy", "move"]) {
  await spec(`${action}-dialog-deep-tree`, {}, async (env) => {
    const { page } = env
    await go(page, `${MOUNT}/文档`)
    await selectRows(page, "笔记", false)
    await page.locator(`[data-selection-bar] [data-action="${action}"]`).click()
    const dialog = page.locator('[role="dialog"]').first()
    await dialog.waitFor({ state: "visible", timeout: 4000 })
    for (const name of [MOUNT.slice(1), "深层", ...DEEP]) {
      const label = dialog.locator(".folder-tree-box").getByText(name, { exact: true })
      await label.waitFor({ timeout: 6000 })
      await label.click()
      await page.waitForTimeout(250)
    }
    const m = await dialog.evaluate((d) => {
      const box = d.querySelector(".folder-tree-box")
      const r = d.getBoundingClientRect()
      const b = box.getBoundingClientRect()
      return {
        dialog: `${Math.round(r.left)}..${Math.round(r.right)}`,
        box: `${Math.round(b.left)}..${Math.round(b.right)}`,
        widened: r.left < -1 || r.right > innerWidth + 1 || d.scrollWidth > d.clientWidth + 1,
        outside: b.left < r.left - 1 || b.right > r.right + 1,
        scrolls: box.scrollWidth > box.clientWidth,
      }
    })
    log(`${action} dialog`, JSON.stringify(m))
    if (m.widened) throw new Error(`the ${action} dialog is wider than the window (${m.dialog} in 0..1440)`)
    if (m.outside) throw new Error(`the ${action} dialog's tree sticks out of it (${m.box} in ${m.dialog})`)
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
// txcloud's /storage/115/云下载 (plan §0, 3b): a library root that is no work
// itself (by_path 404), 78 folders of which 69 are identified works, none with
// a poster. The conditions are checked first, then the page.
for (const [view, width] of [["poster", 1440], ["poster", 390], ["list", 1440]]) {
  await spec(`library-root-without-posters-${view}`, { width, height: width === 390 ? 844 : 900 }, async (env) => {
    const { page } = env
    const lib = `${MOUNT}/大媒体库`
    const api = (p) => fetch(OL + p, { headers: { Authorization: token } }).then((r) => r.json())
    const self = await api(`/api/fs/media/by_path?path=${encodeURIComponent(lib)}`)
    const list = await api(`/api/fs/media/list?media_type=video&path=${encodeURIComponent(lib)}&page=1&page_size=200`)
    const works = list.data?.content ?? []
    const cond = { byPath: self.code, works: works.length, withPoster: works.filter((w) => w.poster_url).length }
    log("library root conditions", JSON.stringify(cond))
    if (cond.byPath !== 404 || cond.works < 69 || cond.withPoster) throw new Error(`the seeded library does not match txcloud's: ${JSON.stringify(cond)}`)
    await go(page, lib, 2500)
    if (view === "list") {
      // the user's screenshot: the list view with one folder selected
      await page.locator("[data-files-view]").click()
      await page.getByRole("menuitem", { name: tr("home.layouts.list") }).first().click()
      await page.waitForTimeout(1200)
      await selectRows(page, "影片1 (1951)", false)
    }
    const m = await page.evaluate(() => {
      const bar = document.querySelector("[data-files-toolbar]").getBoundingClientRect()
      const rows = [...document.querySelectorAll(".viselect-item")]
      const head = document.querySelector(".list > .title")
      const tops = [rows[0], head].filter(Boolean).map((e) => e.getBoundingClientRect().top)
      return {
        rows: rows.length,
        list: !!document.querySelector(".list"),
        gap: tops.length ? Math.round(Math.min(...tops) - bar.bottom) : null,
      }
    })
    log(`library root ${view}`, JSON.stringify(m))
    if (!m.rows) throw new Error("the library root shows no entries")
    if (view === "list" && !m.list) throw new Error("the list view did not come up")
    if (m.gap > 90) throw new Error(`${m.gap}px between the breadcrumb bar and the first entry (${m.rows} entries)`)
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
    log(`card edges ${theme}`, JSON.stringify(rows))
    const weak = rows.filter((r) => r.missing || r.edge < 1.4)
    if (weak.length) throw new Error("no visible edge: " + weak.map((r) => (r.missing ? `${r.name} (not found)` : `${r.name} (border ${r.bw}px ${r.border}:1, fill ${r.fill}:1)`)).join("; "))
  })
}

fs.writeFileSync(path.join(out, "bugs.json"), JSON.stringify(results, null, 1))
await browser.close()
const failed = results.filter((r) => !r.ok)
log(`${results.length - failed.length}/${results.length} specs passed`)
process.exit(failed.length ? 1 : 0)
