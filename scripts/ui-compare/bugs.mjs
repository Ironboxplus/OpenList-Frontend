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
import { alive, log, MOUNT, OL, olGet, olPost, row, seed, selectRows, tr } from "./lib.mjs"
import { layoutChecks } from "./checks.mjs"

const out = process.argv[2]
fs.mkdirSync(out, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const browser = await chromium.launch()
// Video plays in the system Chrome: movi decodes H.264 through WebCodecs, which
// the bundled Chromium builds without (no proprietary codecs)
const AUTOPLAY = ["--autoplay-policy=no-user-gesture-required"]
let chromeBrowser
const systemChrome = async () =>
  (chromeBrowser ??= await chromium.launch({ channel: "chrome", args: AUTOPLAY }).catch((e) => {
    log("no system Chrome, using the bundled Chromium:", String(e?.message || e).split("\n")[0])
    return chromium.launch({ args: AUTOPLAY })
  }))
const { token, ids, shares } = await seed(out)

const results = []
// BUGS_FILTER (a regular expression on the spec name) runs only the specs of
// the change at hand; the gate runs all of them
const only = process.env.BUGS_FILTER ? new RegExp(process.env.BUGS_FILTER) : null
async function spec(name, opts, fn) {
  if (only && !only.test(name)) return
  const { width = 1440, height = 900, theme = "light", reducedMotion = "no-preference" } = opts
  const id = `${name}.${width}${height !== 900 && width === 1440 ? `x${height}` : ""}.${theme}${reducedMotion === "reduce" ? ".reduced" : ""}`
  // a recording for the user to watch (P1 gate: dialog, sheet, menu, dropdown, collapsible)
  const video = opts.video ? { recordVideo: { dir: path.join(out, "video-tmp"), size: { width, height } } } : {}
  const touch = opts.touch ? { hasTouch: true, isMobile: true } : {}
  const b = opts.chrome ? await systemChrome() : browser
  const ctx = await b.newContext({ viewport: { width, height }, locale: "zh-CN", colorScheme: theme, reducedMotion, ...touch, ...video })
  await ctx.addInitScript((t) => localStorage.setItem("token", t), token)
  for (const init of [].concat(opts.init ?? [])) await ctx.addInitScript(init)
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
  results.push({ id, ok: !message, message, ...(env.report ? { report: env.report } : {}) })
  log(message ? "FAIL" : "PASS", id, message.split("\n")[0])
  if (message) console.log(message)
  const rec = opts.video ? page.video() : null
  await Promise.race([ctx.close().catch(() => {}), sleep(5000)])
  if (rec) {
    fs.mkdirSync(path.join(out, "video"), { recursive: true })
    await rec.saveAs(path.join(out, "video", `${id}.webm`)).catch((e) => log("video not saved", id, String(e?.message || e)))
    await rec.delete().catch(() => {})
  }
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
// ---- §2.6 of the plan: the desktop side nav is dragged wider by a handle on
// its right edge (a WAI-ARIA window splitter), 220 up to half the window
const HANDLE = '[role="separator"][aria-controls="shell-side-nav"]'
const SHELL_LEFT = 12
const navHandle = async (page) => {
  const h = page.locator(HANDLE)
  if (!(await h.count())) throw new Error("the side nav has no resize handle")
  return h
}
const navGeom = (page) =>
  page.evaluate((sel) => {
    // by id: the phone's bottom tabs are a nav "main" too
    const nav = document.getElementById("shell-side-nav")
    const card = document.querySelector("[data-shell-content]").getBoundingClientRect()
    const h = document.querySelector(sel)
    return {
      nav: nav && Math.round(nav.getBoundingClientRect().width),
      card: Math.round(card.left),
      cardWidth: Math.round(card.width),
      handle: !!h,
      now: h && Number(h.getAttribute("aria-valuenow")),
      max: h && Number(h.getAttribute("aria-valuemax")),
      stored: localStorage.getItem("shell-nav-width"),
    }
  }, HANDLE)
// press on the handle's middle and move the pointer to x
const dragTo = async (page, handle, x) => {
  const b = await handle.boundingBox()
  const y = b.y + b.height / 2
  await page.mouse.move(b.x + b.width / 2, y)
  await page.mouse.down()
  await page.mouse.move(x, y, { steps: 8 })
  await page.mouse.up()
  await page.waitForTimeout(400)
}
const expectWidth = (g, w, what) => {
  if (Math.abs(g.nav - w) > 1 || g.now !== w || Math.abs(g.card - (SHELL_LEFT + w + 12)) > 1)
    throw new Error(`${what}: nav ${g.nav}px, handle says ${g.now}, content card at ${g.card}; expected ${w}, ${w}, ${SHELL_LEFT + w + 12}`)
}
// the deepest name against the tree box, at the default sideways scroll
const deepestName = (page) =>
  page.locator('nav[aria-label="main"] [role="treeitem"][aria-selected="true"] > div:first-child').first().evaluate((row) => {
    const box = row.closest(".folder-tree-box")
    const b = box.getBoundingClientRect()
    const l = b.left + box.clientLeft
    const rr = l + box.clientWidth
    const r = row.querySelector(":scope > span:last-of-type").getBoundingClientRect()
    return {
      scrollLeft: box.scrollLeft,
      shown: Math.round(Math.min(r.right, rr) - Math.max(r.left, l)),
      whole: r.left >= l - 1 && r.right <= rr + 1,
      at: `${Math.round(r.left)}..${Math.round(r.right)} in ${Math.round(l)}..${Math.round(rr)}`,
    }
  })
// 1. dragged to 480 the nav, the content card and the visible part of the
// deepest name follow by 260px; at the widest (720 = half of 1440) the whole
// name shows; dragged far left it stops at 220
await spec("nav-resize-drag", {}, async (env) => {
  const { page } = env
  await go(page, `${MOUNT}/深层/${DEEP.join("/")}`, 1500)
  const h = await navHandle(page)
  const before = await deepestName(page)
  await dragTo(page, h, SHELL_LEFT + 480)
  const g = await navGeom(page)
  const at480 = await deepestName(page)
  log("nav resize drag to 480", JSON.stringify({ g, before, at480 }))
  expectWidth(g, 480, "dragged to 480")
  if (g.stored !== "480") throw new Error(`the width is not remembered: stored ${g.stored}`)
  if (at480.shown < before.shown + 258) throw new Error(`the deepest name shows ${at480.shown}px at 480, ${before.shown}px at 220 (${at480.at})`)
  await dragTo(page, h, 1400)
  const gMax = await navGeom(page)
  const atMax = await deepestName(page)
  log("nav resize drag far right", JSON.stringify({ gMax, atMax }))
  expectWidth(gMax, 720, "dragged past the widest")
  if (atMax.scrollLeft !== 0 || !atMax.whole) throw new Error(`at the widest the deepest name is not whole (${atMax.at}, scrollLeft ${atMax.scrollLeft})`)
  await dragTo(page, h, 0)
  const gMin = await navGeom(page)
  log("nav resize drag far left", JSON.stringify(gMin))
  expectWidth(gMin, 220, "dragged past the narrowest")
})
// 2. the width survives a reload
await spec("nav-resize-persists", {}, async (env) => {
  const { page } = env
  await go(page, `${MOUNT}/文档`)
  await dragTo(page, await navHandle(page), SHELL_LEFT + 400)
  expectWidth(await navGeom(page), 400, "dragged to 400")
  await page.reload({ waitUntil: "domcontentloaded" })
  await page.locator(HANDLE).waitFor()
  await page.waitForTimeout(600)
  const g = await navGeom(page)
  log("nav resize after reload", JSON.stringify(g))
  expectWidth(g, 400, "after a reload")
})
// 3. a double click on the handle returns to 220, also after a reload
await spec("nav-resize-dblclick-resets", {}, async (env) => {
  const { page } = env
  await go(page, `${MOUNT}/文档`)
  const h = await navHandle(page)
  await dragTo(page, h, SHELL_LEFT + 400)
  expectWidth(await navGeom(page), 400, "dragged to 400")
  await h.dblclick()
  await page.waitForTimeout(400)
  const g = await navGeom(page)
  log("nav resize double click", JSON.stringify(g))
  expectWidth(g, 220, "after a double click")
  await page.reload({ waitUntil: "domcontentloaded" })
  await page.locator(HANDLE).waitFor()
  await page.waitForTimeout(600)
  expectWidth(await navGeom(page), 220, "after a double click and a reload")
})
// 4. the handle is reached with Tab and moved with the arrow keys, Home, End
await spec("nav-resize-keyboard", {}, async (env) => {
  const { page } = env
  await go(page, `${MOUNT}/文档`)
  const h = await navHandle(page)
  const a = await h.evaluate((el) => ({
    orientation: el.getAttribute("aria-orientation"),
    label: el.getAttribute("aria-label"),
    tabindex: el.getAttribute("tabindex"),
    min: el.getAttribute("aria-valuemin"),
  }))
  log("nav resize handle", JSON.stringify(a))
  if (a.orientation !== "vertical" || !a.label || a.tabindex !== "0" || a.min !== "220")
    throw new Error(`the handle is not a focusable vertical splitter: ${JSON.stringify(a)}`)
  await h.focus()
  const steps = [
    ["ArrowRight", 236],
    ["ArrowRight", 252],
    ["ArrowRight", 268],
    ["ArrowLeft", 252],
    ["End", 720],
    ["ArrowRight", 720],
    ["Home", 220],
    ["ArrowLeft", 220],
  ]
  for (const [key, w] of steps) {
    await page.keyboard.press(key)
    await page.waitForTimeout(250)
    expectWidth(await navGeom(page), w, `after ${key}`)
  }
  if (!(await h.evaluate((el) => el === document.activeElement))) throw new Error("the handle lost focus")
})
// 5. the widest follows the window (the content keeps its room) without
// forgetting the chosen width; the folded rail and the phone have no handle
await spec("nav-resize-limits", {}, async (env) => {
  const { page } = env
  await go(page, `${MOUNT}/文档`)
  const h = await navHandle(page)
  await h.focus()
  await page.keyboard.press("End")
  await page.waitForTimeout(300)
  expectWidth(await navGeom(page), 720, "End at 1440")
  await page.setViewportSize({ width: 1100, height: 900 })
  await page.waitForTimeout(500)
  const narrow = await navGeom(page)
  log("nav resize at 1100", JSON.stringify(narrow))
  expectWidth(narrow, 550, "the window narrowed to 1100")
  if (narrow.max !== 550) throw new Error(`the handle's maximum is ${narrow.max} at 1100, expected 550`)
  if (narrow.cardWidth < 480) throw new Error(`the content card is ${narrow.cardWidth}px wide beside the widest nav`)
  if (narrow.stored !== "720") throw new Error(`a narrower window changed the chosen width: stored ${narrow.stored}`)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.waitForTimeout(500)
  expectWidth(await navGeom(page), 720, "the window back at 1440")
  await page.getByRole("button", { name: tr("shell.nav.collapse") }).first().click()
  await page.waitForTimeout(500)
  const folded = await navGeom(page)
  log("nav resize folded", JSON.stringify(folded))
  if (folded.handle || folded.nav !== 72) throw new Error(`folded: nav ${folded.nav}px, handle ${folded.handle ? "shown" : "hidden"}; expected 72px and no handle`)
  await page.getByRole("button", { name: tr("shell.nav.expand") }).first().click()
  await page.waitForTimeout(500)
  expectWidth(await navGeom(page), 720, "unfolded again")
  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(500)
  const phone = await navGeom(page)
  log("nav resize phone", JSON.stringify(phone))
  if (phone.handle || phone.nav) throw new Error(`the phone layout has ${phone.nav ? "a side nav" : ""} ${phone.handle ? "a resize handle" : ""}`)
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

// ---- the rest of the 046ebfc audit (run 45808288515; plan PLAN_FE_UNIFY_OVERLAYS_1126 §2.2 H)
// A control's own box and whether a click at its centre reaches it.
const hitBox = (loc, what) =>
  loc.evaluate((e, what) => {
    const r = e.getBoundingClientRect()
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
    // the part left after every clipping ancestor (overflow other than visible)
    let [x0, y0, x1, y1] = [r.left, r.top, r.right, r.bottom]
    for (let a = e.parentElement; a; a = a.parentElement) {
      const cs = getComputedStyle(a)
      if (cs.overflowX === "visible" && cs.overflowY === "visible") continue
      const b = a.getBoundingClientRect()
      if (cs.overflowX !== "visible") [x0, x1] = [Math.max(x0, b.left), Math.min(x1, b.right)]
      if (cs.overflowY !== "visible") [y0, y1] = [Math.max(y0, b.top), Math.min(y1, b.bottom)]
    }
    return { what, w: Math.round(Math.max(0, x1 - x0)), h: Math.round(Math.max(0, y1 - y0)), hit: !!top && (top === e || e.contains(top)) }
  }, what)
const expectTargets = (list) => {
  log("click targets", JSON.stringify(list))
  const small = list.filter((t) => t.w < 32 || t.h < 32 || !t.hit)
  if (small.length) throw new Error("under 32px or covered: " + small.map((t) => `${t.what} ${t.w}x${t.h}${t.hit ? "" : " (covered)"}`).join("; "))
}

// B1: the editor of a meta nobody was picked for (the API sends null user lists)
await spec("manage-metas-edit-null-users", {}, async (env) => {
  const { page, errors } = env
  const id = ids.meta?.[0]
  if (!id) throw new Error("the seed made no meta")
  await go(page, `/@manage/metas/edit/${id}`, 1500)
  const value = await page.locator("#path").first().inputValue({ timeout: 4000 }).catch(() => null)
  log("metas edit", JSON.stringify({ id, value, errors }))
  if (errors.length) throw new Error(`page errors: ${errors.join(" | ")}`)
  if (value !== `${MOUNT}/文档`) throw new Error(`the editor does not show the meta (path box: ${value})`)
})

// M1: on a tablet the selection's actions stay left of the top bar's own
// buttons; the ones that do not fit are in the "more" menu
for (const width of [820, 1100]) {
  await spec("selection-bar-fits-top-bar", { width }, async (env) => {
    const { page } = env
    await go(page, `${MOUNT}/文档`)
    await selectRows(page, "笔记", false)
    await page.locator("[data-selection-bar]").waitFor({ timeout: 4000 })
    const m = await page.evaluate(() => {
      const bar = document.querySelector("[data-selection-bar]")
      const right = document.querySelector("[data-error-center-trigger]").parentElement.getBoundingClientRect()
      const shown = [...bar.querySelectorAll("button")].filter((b) => b.getBoundingClientRect().width > 0)
      const barRight = Math.max(...shown.map((b) => b.getBoundingClientRect().right))
      const covered = [...document.querySelectorAll("[data-topbar] button, [data-topbar] a")]
        .filter((b) => !bar.contains(b) && b.getBoundingClientRect().left >= right.left - 1)
        .filter((b) => {
          const r = b.getBoundingClientRect()
          const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
          return !top || !(top === b || b.contains(top))
        })
        .map((b) => b.getAttribute("aria-label") || b.textContent.trim())
      const inline = shown.map((b) => b.dataset.action).filter((a) => a && a !== "cancel_select" && a !== "batch-more")
      return { barRight: Math.round(barRight), rightLeft: Math.round(right.left), covered, inline }
    })
    await page.locator('[data-action="batch-more"]').click()
    await page.waitForTimeout(400)
    const inMenu = await page.locator('[role="menuitem"][data-action]').evaluateAll((els) => els.map((e) => e.dataset.action))
    await page.keyboard.press("Escape")
    log(`selection bar ${width}`, JSON.stringify({ ...m, inMenu }))
    if (m.barRight > m.rightLeft + 1) throw new Error(`the selection bar runs to ${m.barRight}, under the top bar's buttons from ${m.rightLeft}`)
    if (m.covered.length) throw new Error(`top bar buttons covered: ${m.covered.join(", ")}`)
    const missing = ["copy", "move", "rename", "share", "delete"].filter((a) => !m.inline.includes(a) && !inMenu.includes(a))
    if (missing.length) throw new Error(`actions neither in the bar nor in its menu: ${missing.join(", ")}`)
  })
}

// M3: the shares table on a tablet keeps readable columns and every column
// can be scrolled to inside its card; the settings breadcrumb does not show
// a cut crumb ("s >") as if it were a word
await spec("manage-table-fits-tablet", { width: 820 }, async (env) => {
  const { page } = env
  await go(page, "/@manage/shares", 1500)
  const card = page.locator('[data-layout="table"]')
  await card.waitFor({ timeout: 6000 })
  const m = await card.evaluate((c) => {
    const table = c.querySelector("table")
    const fits = table.offsetWidth <= c.clientWidth + 1
    const ox = getComputedStyle(c).overflowX
    c.scrollLeft = c.scrollWidth
    const r = c.getBoundingClientRect()
    const inside = (e) => {
      const b = e.getBoundingClientRect()
      return b.left >= r.left - 1 && b.right <= r.right + 1
    }
    const heads = [...c.querySelectorAll("th")].filter((th) => th.textContent.trim())
    const lastHead = heads[heads.length - 1]
    const edit = c.querySelector("tbody tr td:last-child button")
    const id = c.querySelector("tbody tr td:nth-child(2) span")
    return {
      fits,
      ox,
      lastHead: lastHead?.textContent.trim(),
      lastHeadShown: !!lastHead && inside(lastHead),
      editShown: !!edit && inside(edit),
      idHeight: id ? Math.round(id.getBoundingClientRect().height) : null,
      id: id?.textContent,
    }
  })
  const crumbs = await page.evaluate(() => {
    const n = document.querySelector("[data-settings-crumbs]")
    const cs = getComputedStyle(n)
    const nr = n.getBoundingClientRect()
    const cut = [...n.querySelectorAll("li")].some((li) => {
      const b = li.getBoundingClientRect()
      return b.left < nr.left - 1 && b.right > nr.left + 1
    })
    return { cut, mask: cs.maskImage || cs.webkitMaskImage || "none", scrollLeft: n.scrollLeft }
  })
  log("manage table 820", JSON.stringify({ m, crumbs }))
  if (!m.fits && !["auto", "scroll"].includes(m.ox)) throw new Error(`the table is wider than its card, which does not scroll (overflow-x ${m.ox})`)
  if (!m.lastHeadShown || !m.editShown) throw new Error(`scrolled to the end, the last column (${m.lastHead}) or the Edit button is still cut off`)
  if (m.idHeight > 44) throw new Error(`the id column is squeezed: "${m.id}" stands ${m.idHeight}px tall`)
  if (crumbs.cut && crumbs.mask === "none") throw new Error("the breadcrumb cuts a crumb at its left edge with nothing to show it is cut")
})

// M4: the phone's path sheet shows the full name of every level
await spec("phone-path-sheet-full-names", { width: 390, height: 844 }, async (env) => {
  const { page } = env
  await go(page, `${MOUNT}/深层/${DEEP.slice(0, 3).join("/")}`, 1200)
  await page.locator("[data-files-current]").click()
  await page.waitForTimeout(700)
  const levels = await page.evaluate(() => {
    const sheet = [...document.querySelectorAll('[role="dialog"]')].pop()
    const s = sheet.getBoundingClientRect()
    return [...sheet.querySelectorAll("[data-files-path-level]")].map((b) => {
      const label = b.querySelector(":scope > span:last-child") || b
      const r = label.getBoundingClientRect()
      return {
        text: b.textContent.trim().slice(0, 12),
        clipped: label.scrollWidth > label.clientWidth + 1 || r.right > Math.min(s.right, innerWidth) + 1,
        at: `${Math.round(r.left)}..${Math.round(r.right)} of ${Math.round(Math.min(s.right, innerWidth))}`,
      }
    })
  })
  log("path sheet", JSON.stringify(levels))
  if (levels.length < 5) throw new Error(`the sheet lists ${levels.length} levels`)
  const cut = levels.filter((l) => l.clipped)
  if (cut.length) throw new Error("names cut off: " + cut.map((l) => `${l.text}… ${l.at}`).join("; "))
})

// m1: the small controls the audit found are at least 32px to click
await spec("click-targets-32", {}, async (env) => {
  const { page } = env
  const list = []
  await go(page, `${MOUNT}/文档`, 1200)
  list.push(await hitBox(page.locator('nav[aria-label="main"] button[aria-label="toggle"]:not(.invisible)').first(), "tree caret"))
  list.push(await hitBox(page.locator("[data-files-crumb-menu]").first(), "current crumb menu"))
  await go(page, "/@manage/shares", 1500)
  list.push(await hitBox(page.locator("[data-settings-crumbs] a").first(), "settings crumb"))
  list.push(await hitBox(page.locator('[data-layout="table"] th button').first(), "table sort header"))
  await page.getByRole("button", { name: tr("shell.task_center.title") }).first().click()
  await page.waitForTimeout(700)
  list.push(await hitBox(page.locator('[role="dialog"] button:has(.sr-only)').last(), "sheet close"))
  await page.keyboard.press("Escape")
  await go(page, "/@manage/messenger", 1500)
  // the app's own toast since P4 (components/ui/toast.tsx), not hope's
  const toastClose = page.locator('[data-motion="toast"] [data-testid="toast-close"]').first()
  await toastClose.waitFor({ timeout: 4000 })
  list.push(await hitBox(toastClose, "notification close"))
  expectTargets(list)
})
await spec("click-targets-32-phone", { width: 390, height: 844 }, async (env) => {
  const { page } = env
  const list = []
  await go(page, `${MOUNT}/文档`, 1200)
  list.push(await hitBox(page.locator("[data-files-current]").first(), "current folder button"))
  await go(page, `${MOUNT}/预览/示例音乐.mp3`, 2500)
  for (const icon of ["volume-down", "volume-up", "loop", "order", "menu"]) {
    const loc = page.locator(`.aplayer-time .aplayer-icon-${icon}`)
    if ((await loc.count()) && (await loc.first().isVisible())) list.push(await hitBox(loc.first(), `aplayer ${icon}`))
  }
  expectTargets(list)
})

// m3: a poster that fails to load leaves its card the shape of a poster
await spec("poster-card-failed-image-keeps-shape", {}, async (env) => {
  const { page } = env
  await go(page, `${MOUNT}/媒体库`, 3000)
  const m = await page.evaluate(() => {
    const card = [...document.querySelectorAll(".grid-item")].find((c) => c.textContent.includes("电影甲"))
    if (!card) return { missing: true }
    const f = card.querySelector("[data-grid-cover]")
    if (!f) return { frame: false, card: Math.round(card.getBoundingClientRect().height) }
    const r = f.getBoundingClientRect()
    return { frame: true, ratio: +(r.height / r.width).toFixed(3), img: !!f.querySelector("img") }
  })
  log("failed poster", JSON.stringify(m))
  if (m.missing) throw new Error("no card for 电影甲")
  if (!m.frame) throw new Error(`the failed poster left no 2:3 frame (card ${m.card}px tall)`)
  if (Math.abs(m.ratio - 1.5) > 0.02) throw new Error(`the frame is ${m.ratio}:1, not 3:2`)
})

// m5: a refused autoplay shows "click to play", not a page error
for (const width of [390, 1440]) {
  await spec("audio-autoplay-refused", { width, height: width === 390 ? 844 : 900 }, async (env) => {
    const { page, errors } = env
    await go(page, `${MOUNT}/预览/示例音乐.mp3`, 3000)
    const m = await page.evaluate(() => {
      const n = document.querySelector(".aplayer-notice")
      return {
        player: !!document.querySelector(".aplayer"),
        paused: !!document.querySelector(".aplayer .aplayer-button.aplayer-play"),
        notice: n?.textContent ?? null,
        opacity: n ? getComputedStyle(n).opacity : null,
      }
    })
    log(`audio ${width}`, JSON.stringify({ m, errors }))
    if (errors.length) throw new Error(`page errors: ${errors.join(" | ")}`)
    if (!m.player) throw new Error("no audio player")
    if (!m.paused) throw new Error("the player does not offer its play button")
    if (!tr("home.preview.click_to_play").test(m.notice ?? "") || m.opacity === "0") throw new Error(`no "click to play" notice (notice "${m.notice}", opacity ${m.opacity})`)
  })
}

// m6: the upload test page fits a phone
await spec("test-page-fits-phone", { width: 390, height: 844 }, async (env) => {
  const { page } = env
  await go(page, "/@test", 1500)
  const w = await page.evaluate(() => document.documentElement.scrollWidth)
  log("test page width", w)
  if (w > 391) throw new Error(`the page is ${w}px wide on a 390px phone`)
})

// m7: a required field turns red after the user leaves it, not on arrival
await spec("add-share-required-not-red-on-arrival", { width: 390, height: 844 }, async (env) => {
  const { page } = env
  await go(page, "/@manage/shares/add", 1500)
  const files = page.locator("#files")
  await files.waitFor({ timeout: 6000 })
  const before = await files.getAttribute("aria-invalid")
  await files.focus()
  await page.locator("#remark").focus()
  await page.waitForTimeout(200)
  const after = await files.getAttribute("aria-invalid")
  log("add share required", JSON.stringify({ before, after }))
  if (before === "true") throw new Error("the empty share paths are red before the user touched them")
  if (after !== "true") throw new Error("the empty share paths are not marked after the user left them")
})

// E (PLAN_FE_UNIFY_OVERLAYS_1126 §2.2): a dropdown inside a dialog or sheet
// opens, and its option is picked by mouse. A list portalled out of a
// Kobalte modal is inert and unclickable; the dialog must stay open.
const dialogSelect = (name, opts, open) =>
  spec(name, opts, async (env) => {
    const { page } = env
    fire(await open(page))
    await expectDialog(env, name)
    const dialog = page.locator('[role="dialog"]').first()
    const triggers = dialog.locator('button[aria-haspopup="listbox"]')
    const n = await triggers.count()
    if (!n) throw new Error(`${name}: no dropdown in the dialog`)
    for (let i = 0; i < n; i++) {
      const trigger = triggers.nth(i)
      await trigger.scrollIntoViewIfNeeded()
      const before = (await trigger.innerText()).trim()
      await trigger.click()
      const list = page.locator('[role="listbox"]').last()
      await list.waitFor({ state: "visible", timeout: 2000 }).catch(() => {
        throw new Error(`${name}: dropdown ${i + 1} of ${n} ("${before}") did not open on a click`)
      })
      const options = list.locator('[role="option"]')
      const count = await options.count()
      // the first option not chosen now
      let pick = -1
      for (let k = 0; k < count && pick < 0; k++)
        if ((await options.nth(k).getAttribute("aria-selected")) !== "true") pick = k
      if (pick < 0) {
        await page.keyboard.press("Escape")
        log(`${name}: dropdown ${i + 1} has only its chosen option`)
        continue
      }
      const want = (await options.nth(pick).innerText()).trim()
      await options.nth(pick).click({ timeout: 2000 }).catch((e) => {
        throw new Error(`${name}: option "${want}" of dropdown ${i + 1} could not be clicked: ${String(e.message).split("\n")[0]}`)
      })
      await page.waitForTimeout(300)
      const after = (await trigger.innerText()).trim()
      log(`${name}: dropdown ${i + 1}: "${before}" -> "${after}" (picked "${want}")`)
      if (!(await dialog.isVisible())) throw new Error(`${name}: picking in dropdown ${i + 1} closed the dialog`)
      if (!after.includes(want)) throw new Error(`${name}: dropdown ${i + 1} shows "${after}" after picking "${want}"`)
    }
  })
// (the share dialog has no dropdown since P2: its order of the files is one
// control of buttons and a switch, see share-dialog-order below)
await dialogSelect("dialog-select-local-settings", {}, async (page) => {
  await go(page, `${MOUNT}/文档`)
  await page.locator("[data-files-more]").click()
  return page.getByRole("menuitem", { name: tr("home.toolbar.local_settings") }).first()
})
await dialogSelect("dialog-select-offline-download", {}, async (page) => {
  await go(page, `${MOUNT}/文档`)
  await page.locator("[data-files-new]").click()
  return page.locator('[role="menuitem"][data-action="offline_download"]')
})

// §3 (PLAN_FE_UNIFY_OVERLAYS_1126): the tallest dialogs keep their footer
// within reach on a phone and a tablet: scrolled into view inside the dialog,
// the last button is on screen and is what a click there hits.
const tallDialog = (name, opts, open) =>
  spec(name, opts, async (env) => {
    const { page } = env
    fire(await open(page))
    await expectDialog(env, name)
    const dialog = page.locator('[role="dialog"]').last()
    await page.waitForTimeout(500)
    const last = dialog.locator("button:visible").last()
    await last.scrollIntoViewIfNeeded()
    const m = await last.evaluate((el) => {
      const r = el.getBoundingClientRect()
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
      const d = el.closest('[role="dialog"]').getBoundingClientRect()
      return { text: el.textContent.trim(), top: Math.round(r.top), bottom: Math.round(r.bottom), vh: innerHeight, dialog: [Math.round(d.top), Math.round(d.bottom)], hits: !!hit && (hit === el || el.contains(hit)) }
    })
    log(`${name}`, JSON.stringify(m))
    if (m.top < 0 || m.bottom > m.vh) throw new Error(`${name}: the footer's "${m.text}" is off screen (${m.top}..${m.bottom} of ${m.vh})`)
    if (!m.hits) throw new Error(`${name}: a click on the footer's "${m.text}" lands on something else`)
  })
for (const size of [PHONE, { width: 820, height: 1180 }]) {
  await tallDialog("tall-dialog-offline-download", size, async (page) => {
    await go(page, `${MOUNT}/文档`)
    // the phone has the + button and its sheet in place of the New menu
    if (size === PHONE) {
      await page.locator("[data-files-fab]").click()
      return page.locator('[data-fab-action="offline_download"]')
    }
    await page.locator("[data-files-new]").click()
    return page.locator('[role="menuitem"][data-action="offline_download"]')
  })
  await tallDialog("tall-dialog-batch-rename", size, async (page) => {
    await go(page, `${MOUNT}/文档`)
    await page.locator("[data-files-more]").click()
    return page.getByRole("menuitem", { name: tr("home.toolbar.batch_rename") }).first()
  })
  await tallDialog("tall-dialog-torrent-pieces", size, async (page) => {
    await go(page, `${MOUNT}/预览/种子.torrent`, 2500)
    return page.getByRole("button", { name: tr("home.transfer_seed.piece_hashes") }).first()
  })
}

// §3: a hope-API Tooltip shows beside its child after a hover, and adds no
// element around the child (the image preview's toolbar buttons). Images open
// in the image viewer now; the image preview is its Open with, in the
// document viewer, which the address can ask for.
await spec("tooltip-beside-child", {}, async (env) => {
  const { page } = env
  await go(page, `${MOUNT}/预览/图片.jpg?preview=image`, 2500)
  const button = page.getByRole("button", { name: "Zoom in", exact: true }).first()
  await button.waitFor()
  const parentBefore = await button.evaluate((el) => {
    el.parentElement.setAttribute("data-tip-parent", "")
    return el.parentElement.children.length
  })
  await button.hover()
  const tip = page.locator('[role="tooltip"]').first()
  await tip.waitFor({ state: "visible", timeout: 3000 }).catch(() => {
    throw new Error("no tooltip within 3 s of hovering the zoom-in button")
  })
  const m = await button.evaluate((el) => {
    const t = document.querySelector('[role="tooltip"]')
    const a = el.getBoundingClientRect()
    const b = t.getBoundingClientRect()
    const gap = Math.max(b.top - a.bottom, a.top - b.bottom, b.left - a.right, a.left - b.right)
    return { text: t.textContent.trim(), gap: Math.round(gap), sameParent: el.parentElement.hasAttribute("data-tip-parent"), siblings: el.parentElement.children.length, describedBy: el.getAttribute("aria-describedby") === t.id || !!t.closest(`#${CSS.escape(el.getAttribute("aria-describedby") || "x")}`) }
  })
  log("tooltip", JSON.stringify({ ...m, parentBefore }))
  if (!m.text.includes("Zoom in")) throw new Error(`the tooltip reads "${m.text}"`)
  if (m.gap > 24) throw new Error(`the tooltip is ${m.gap}px away from its button`)
  if (!m.sameParent || m.siblings !== parentBefore) throw new Error(`the button's parent changed on hover (${parentBefore} -> ${m.siblings} children)`)
})

// E1: the edges on the first load, in the mode the user had, equal what they
// are after toggling the theme twice (user: "列表边缘还是切换亮暗色之后才会恢复正常").
// The cause (7f3bd3c): hope rewrote the files card's class attribute when its
// theme-dependent bgColor changed, dropping the files-card class a classList
// had added. The user chose the look after the toggle (11-26): the list is a
// card of its own, rounded, with a shadow and padding, from the first load on.
// Recorded: every edged element's computed borders (four sides), shadow, the
// files card's classes and surface, the rules CDP matches on the content card
// and its mask, the head's stylesheets, and a pixel comparison.
const edgeState = (page) =>
  page.evaluate(() => {
    const desc = (e) =>
      e.tagName.toLowerCase() +
      [...e.attributes].filter((a) => a.name.startsWith("data-")).map((a) => `[${a.name}]`).join("") +
      (typeof e.className === "string" ? e.className : "").split(/\s+/).filter((c) => /^(obj-box|files-card|list|title|list-item|grid-item|grid-card|selected|border|rounded.*)$/.test(c)).slice(0, 5).map((c) => "." + c).join("")
    const side = (cs, s) => (parseFloat(cs[`border${s}Width`]) > 0 && cs[`border${s}Style`] !== "none" ? `${cs[`border${s}Width`]} ${cs[`border${s}Style`]} ${cs[`border${s}Color`]}` : "-")
    const out = []
    const roots = ["[data-shell-content]", "[data-shell-mask]", "[data-storage-card]"].map((q) => document.querySelector(q)).filter(Boolean)
    for (const r of roots)
      for (const e of [r, ...r.querySelectorAll("*")]) {
        if (out.length >= 150) break
        const cs = getComputedStyle(e)
        const sides = ["Top", "Right", "Bottom", "Left"].map((s) => side(cs, s))
        const classed = /(^|\s)(border|divide)(\s|$|-)/.test(typeof e.className === "string" ? e.className : "")
        const shadow = cs.boxShadow !== "none" ? cs.boxShadow : ""
        if (!classed && !shadow && sides.every((x) => x === "-")) continue
        out.push({ el: desc(e), sides: sides.join(" | "), shadow, bg: cs.backgroundColor })
      }
    const cls = (el) => [...el.classList].sort().join(" ")
    const box = document.querySelector(".obj-box")
    return {
      html: cls(document.documentElement),
      body: cls(document.body),
      // the files page's own card and its rows: which classes they carry
      objBox: box ? cls(box) : "none",
      card: box
        ? (({ boxShadow, borderTopLeftRadius, paddingTop, backgroundColor }) => ({ shadow: boxShadow, radius: borderTopLeftRadius, padding: paddingTop, bg: backgroundColor }))(getComputedStyle(box))
        : null,
      rows: [...document.querySelectorAll(".obj-box .list-item, .obj-box .grid-item, .obj-box .list > .title")]
        .slice(0, 3)
        .map(cls),
      sheets: [...document.styleSheets].map((s, i) => `${i}:${s.href ? s.href.split("/").pop() : s.ownerNode?.tagName.toLowerCase() + (s.ownerNode?.id ? "#" + s.ownerNode.id : "")}:${s.cssRules.length}`),
      edges: out,
    }
  })
const edgeRules = async (cdp, selector) => {
  await cdp.send("DOM.enable")
  await cdp.send("CSS.enable")
  const { root } = await cdp.send("DOM.getDocument", { depth: 0 })
  const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector })
  if (!nodeId) return [`${selector}: not found`]
  const m = await cdp.send("CSS.getMatchedStylesForNode", { nodeId })
  return (m.matchedCSSRules || []).flatMap(({ rule }) => {
    const props = rule.style.cssProperties.filter((x) => /^(border|box-shadow)/.test(x.name) && x.value)
    return props.length ? [`${selector} <= ${rule.origin} sheet ${rule.styleSheetId} "${rule.selectorList.text.slice(0, 70)}" {${props.map((x) => `${x.name}: ${x.value}`).join("; ")}}`] : []
  })
}
/** Pixels of two PNGs (decoded in the page) that differ by more than 24 in a channel, and where. */
const pixelDiff = (page, a, b) =>
  page.evaluate(
    async ([a, b]) => {
      const load = async (src) => {
        const img = new Image()
        img.src = "data:image/png;base64," + src
        await img.decode()
        const c = document.createElement("canvas")
        c.width = img.width
        c.height = img.height
        const g = c.getContext("2d")
        g.drawImage(img, 0, 0)
        return g.getImageData(0, 0, c.width, c.height)
      }
      const [x, y] = [await load(a), await load(b)]
      if (x.width !== y.width || x.height !== y.height) return { count: -1, size: [x.width, x.height, y.width, y.height] }
      let count = 0
      const box = [Infinity, Infinity, -1, -1]
      for (let i = 0; i < x.data.length; i += 4) {
        const d = Math.max(Math.abs(x.data[i] - y.data[i]), Math.abs(x.data[i + 1] - y.data[i + 1]), Math.abs(x.data[i + 2] - y.data[i + 2]))
        if (d <= 24) continue
        count++
        const px = (i / 4) % x.width
        const py = Math.floor(i / 4 / x.width)
        box[0] = Math.min(box[0], px); box[1] = Math.min(box[1], py); box[2] = Math.max(box[2], px); box[3] = Math.max(box[3], py)
      }
      return { count, box: count ? box : null }
    },
    [a.toString("base64"), b.toString("base64")],
  )
const E1_MODES = [
  { name: "light", theme: "light" },
  { name: "dark-system", theme: "dark" },
  { name: "dark-stored", theme: "light", init: () => localStorage.setItem("hope-ui-color-mode", "dark") },
]
for (const layout of ["grid", "list"]) {
  for (const mode of E1_MODES) {
    await spec(`edges-first-load-${layout}-${mode.name}`, { theme: mode.theme, init: mode.init }, async (env) => {
      const { page, cdp, id } = env
      await go(page, `${MOUNT}/文档`, 1200)
      // the layout is remembered per folder: choose it, then load afresh
      await page.locator("[data-files-view]").click()
      await page.getByRole("menuitem", { name: tr(`home.layouts.${layout}`) }).first().click()
      await page.waitForTimeout(400)
      await page.reload({ waitUntil: "domcontentloaded" })
      await page.waitForLoadState("networkidle", { timeout: 6000 }).catch(() => {})
      await page.waitForTimeout(1500)
      const card = page.locator("[data-shell-content]")
      // the pointer rests off every control, before both measurements
      await page.mouse.move(1, 1)
      await page.waitForTimeout(500)
      const first = await edgeState(page)
      const firstShot = await card.screenshot({ path: path.join(out, `${id}.first.png`) })
      const rules = [...(await edgeRules(cdp, "[data-shell-content]")), ...(await edgeRules(cdp, "[data-shell-mask]"))]
      const toggle = page.getByRole("button", { name: tr("shell.nav.toggle_theme") }).first()
      await toggle.click()
      await page.waitForTimeout(700)
      await toggle.click()
      // the toggle's tooltip closes once the pointer has left it
      await page.mouse.move(1, 1)
      await page.waitForTimeout(1500)
      const again = await edgeState(page)
      const againShot = await card.screenshot({ path: path.join(out, `${id}.again.png`) })
      log(`edges ${layout} ${mode.name}`, JSON.stringify({ html: first.html, body: first.body, sheets: first.sheets }))
      log("  obj-box first", first.objBox)
      log("  obj-box again", again.objBox)
      first.rows.forEach((r, i) => log(`  row ${i} first`, r))
      again.rows.forEach((r, i) => log(`  row ${i} again`, r))
      for (const r of rules) log("  rule", r)
      // compared by element, the n-th of its kind
      const keyed = (edges) => {
        const seen = new Map()
        return new Map(
          edges.map((e) => {
            const k = seen.get(e.el) ?? 0
            seen.set(e.el, k + 1)
            return [`${e.el}#${k}`, JSON.stringify({ sides: e.sides, shadow: e.shadow, bg: e.bg })]
          }),
        )
      }
      const a = keyed(first.edges)
      const b = keyed(again.edges)
      const diffs = []
      for (const k of new Set([...a.keys(), ...b.keys()]))
        if (a.get(k) !== b.get(k)) diffs.push(`${k}: ${a.get(k) ?? "absent"} -> ${b.get(k) ?? "absent"}`)
      if (first.objBox !== again.objBox) diffs.unshift(`.obj-box classes: "${first.objBox}" -> "${again.objBox}"`)
      const pix = await pixelDiff(page, firstShot, againShot)
      const samePixels = pix.count === 0
      log(`edges ${layout} ${mode.name}: ${first.edges.length} edged elements, ${diffs.length} differ after two toggles; pixels: ${JSON.stringify(pix)}`)
      for (const d of diffs.slice(0, 25)) log("  differs", d)
      log("  card first", JSON.stringify(first.card))
      log("  card again", JSON.stringify(again.card))
      if (!first.card || first.card.shadow === "none" || !(parseFloat(first.card.radius) > 0) || !(parseFloat(first.card.padding) > 0))
        throw new Error(`the files list is not a card on the first load: ${JSON.stringify(first.card)}`)
      if (JSON.stringify(first.card) !== JSON.stringify(again.card)) diffs.unshift(`files card: ${JSON.stringify(first.card)} -> ${JSON.stringify(again.card)}`)
      const frame = first.edges.find((e) => e.el.startsWith("div[data-shell-content]"))
      if (!frame || frame.sides.includes("- |") || frame.sides.startsWith("-")) throw new Error(`the content card has no full border on the first load: ${JSON.stringify(frame)}`)
      if (first.html !== again.html || first.body !== again.body) throw new Error(`two toggles did not return to the first mode: html "${first.html}" -> "${again.html}", body "${first.body}" -> "${again.body}"`)
      if (diffs.length) throw new Error(`${diffs.length} edges differ between the first load and after two toggles; first: ${diffs[0]}`)
      if (!samePixels) throw new Error(`the content card looks different after two toggles: ${JSON.stringify(pix)} (see the .first/.again shots)`)
    })
  }
}

// E1 (review 11-26): the list's header row stays at the top of the view while
// a long list scrolls, on the card's surface, the same on the first load and
// after two theme toggles.
for (const theme of ["light", "dark"]) {
  await spec("list-header-sticky", { theme }, async (env) => {
    const { page } = env
    const dir = `${MOUNT}/大媒体库`
    await go(page, dir, 1500)
    await page.locator("[data-files-view]").click()
    await page.getByRole("menuitem", { name: tr("home.layouts.list") }).first().click()
    await page.waitForTimeout(400)
    await page.reload({ waitUntil: "domcontentloaded" })
    await page.waitForLoadState("networkidle", { timeout: 6000 }).catch(() => {})
    await page.waitForTimeout(1500)
    const header = page.locator(".obj-box .list > .title").first()
    await header.waitFor()
    const measure = () =>
      header.evaluate((el) => {
        const r = el.getBoundingClientRect()
        const cs = getComputedStyle(el)
        const card = getComputedStyle(el.closest(".obj-box"))
        // where the sticky row is meant to stop: its resolved `top`
        const stickTop = parseFloat(cs.top)
        const hit = document.elementFromPoint(r.left + 12, r.top + r.height / 2)
        // ancestors that move it: a transform left behind shifts a stuck row
        const moved = []
        for (let e = el.parentElement; e; e = e.parentElement) {
          const c = getComputedStyle(e)
          if (c.transform !== "none" || c.translate !== "none") moved.push(`${e.tagName.toLowerCase()}.${[...e.classList].slice(0, 3).join(".")} transform=${c.transform} translate=${c.translate} inline="${e.style.transform}"`)
        }
        return { top: Math.round(r.top), stickTop: Math.round(stickTop), position: cs.position, z: cs.zIndex, bg: cs.backgroundColor, cardBg: card.backgroundColor, hit: !!hit && el.contains(hit), scrolled: Math.round(scrollY + (document.querySelector("[data-shell-content]")?.scrollTop ?? 0)), moved }
      })
    const scrollDown = async () => {
      const box = await page.locator(".obj-box .list").first().boundingBox()
      await page.mouse.move(box.x + box.width / 2, Math.min(box.y + box.height / 2, 700))
      await page.mouse.wheel(0, 2400)
      await page.waitForTimeout(800)
      await page.mouse.move(1, 1)
      await page.waitForTimeout(300)
    }
    await scrollDown()
    const first = await measure()
    log(`list header ${theme} first`, JSON.stringify(first))
    const toggle = page.getByRole("button", { name: tr("shell.nav.toggle_theme") }).first()
    await toggle.click()
    await page.waitForTimeout(700)
    await toggle.click()
    await page.mouse.move(1, 1)
    await page.waitForTimeout(1500)
    await scrollDown()
    const again = await measure()
    log(`list header ${theme} again`, JSON.stringify(again))
    if (first.scrolled < 200) throw new Error(`the list did not scroll: ${JSON.stringify(first)}`)
    if (first.position !== "sticky") throw new Error(`the header is not sticky: ${first.position}`)
    if (!(first.stickTop > 0) || Math.abs(first.top - first.stickTop) > 2 || !first.hit) throw new Error(`the header is not at the top of the view after scrolling: ${JSON.stringify(first)}`)
    if (first.bg !== first.cardBg) throw new Error(`the header's background ${first.bg} is not the card's ${first.cardBg}`)
    const keys = ["top", "position", "z", "bg", "cardBg", "hit"]
    const changed = keys.filter((k) => first[k] !== again[k])
    if (changed.length) throw new Error(`after two toggles the header differs in ${changed.join(", ")}: ${JSON.stringify(first)} -> ${JSON.stringify(again)}`)
  })
}

// ======== P1 of docs/PLAN_FE_SYSTEM_UX_1127.md ========

// ---- P1.1 motion of the overlays (research 02 §三, 05 §二.3): every overlay
// that appears is followed from the frame it is inserted until it leaves the
// DOM: the animations the browser runs on it (duration, curve, which
// properties), its opacity and transform per frame, when it is told to close
// (data-closed) and when it is removed. The element that moves carries
// data-motion; before that existed the overlay is found by its role.
const overlayProbe = () => {
  const SEL = '[data-motion], [role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"], [role="tooltip"]'
  const recs = (window.__overlayMotion = [])
  const track = (el) => {
    if (el.__om) return
    // a role element inside a data-motion element is the same overlay
    if (!el.hasAttribute("data-motion") && el.parentElement?.closest("[data-motion]")) return
    const kind = el.getAttribute("data-motion") || el.getAttribute("role")
    const r = { kind, t0: performance.now(), closedAt: null, removedAt: null, anims: [], frames: [], marks: [] }
    el.__om = r
    recs.push(r)
    const grab = () => {
      // a collapsible fades its body, a child of the element whose height moves
      for (const a of el.getAnimations(kind === "collapsible" ? { subtree: true } : undefined)) {
        if (a.__om) continue
        a.__om = true
        const kf = a.effect?.getKeyframes?.() ?? []
        const tm = a.effect?.getTiming?.() ?? {}
        const props = [...new Set(kf.flatMap((f) => Object.keys(f)))].filter((p) => !["offset", "easing", "composite", "computedOffset"].includes(p))
        const last = r.marks[r.marks.length - 1]
        r.anims.push({ at: Math.round(performance.now() - r.t0), phase: last ? (last[1] === "closed" ? "exit" : "enter") : r.closedAt === null ? "enter" : "exit", target: a.effect?.target === el ? "self" : "child", duration: Number(tm.duration), easing: String(tm.easing).replace(/\s+/g, ""), kfEasing: kf.map((f) => String(f.easing).replace(/\s+/g, "")), props, css: a.animationName || "" })
      }
    }
    // sampled for 400 frames after it appears and after each open or close
    let budget = 400
    let running = false
    const frame = () => {
      if (!el.isConnected) {
        if (r.removedAt === null) r.removedAt = performance.now()
        running = false
        return
      }
      const cs = getComputedStyle(el)
      r.frames.push([Math.round(performance.now() - r.t0), +(+cs.opacity).toFixed(3), cs.transform, +el.getBoundingClientRect().height.toFixed(2)])
      grab()
      if (--budget > 0) requestAnimationFrame(frame)
      else running = false
    }
    const sample = () => {
      budget = 400
      if (!running) {
        running = true
        frame()
      }
    }
    sample()
    new MutationObserver(() => {
      const closed = el.hasAttribute("data-closed")
      const last = r.marks[r.marks.length - 1]
      if (!last || last[1] !== (closed ? "closed" : "expanded")) r.marks.push([Math.round(performance.now() - r.t0), closed ? "closed" : "expanded"])
      if (closed && r.closedAt === null) r.closedAt = performance.now()
      grab()
      sample()
    }).observe(el, { attributes: true, attributeFilter: ["data-closed", "data-expanded"] })
  }
  new MutationObserver((ms) => {
    for (const m of ms) {
      for (const n of m.addedNodes) if (n.nodeType === 1) [n, ...n.querySelectorAll(SEL)].filter((e) => e.matches(SEL)).forEach(track)
      for (const n of m.removedNodes)
        if (n.nodeType === 1) for (const e of [n, ...n.querySelectorAll(SEL)]) if (e.__om && e.__om.removedAt === null) e.__om.removedAt = performance.now()
    }
    // the document: an init script runs before <html> exists
  }).observe(document, { childList: true, subtree: true })
}
const DECEL = "cubic-bezier(0.05,0.7,0.1,1)"
const ACCEL = "cubic-bezier(0.3,0,0.8,0.15)"
/** The probe's record of the last overlay of `kind`, durations relative to its insertion. */
const overlayRecord = async (page, kind) => {
  const recs = await page.evaluate(() =>
    window.__overlayMotion.map((r) => {
      const closed = r.closedAt === null ? Infinity : r.closedAt - r.t0
      // how it looked at rest, just before it was told to close
      const rest = r.frames.filter((f) => f[0] < closed).pop() ?? null
      return { ...r, closedAt: r.closedAt === null ? null : Math.round(r.closedAt - r.t0), removedAt: r.removedAt === null ? null : Math.round(r.removedAt - r.t0), rest, frames: r.frames.slice(0, 40) }
    }),
  )
  const mine = recs.filter((r) => r.kind === kind)
  return { rec: mine[mine.length - 1], kinds: recs.map((r) => r.kind) }
}
/** Enter and exit of one overlay against the plan's duration and curve. */
const expectOverlayMotion = (env, kind, { rec, kinds }, enter, exit, moves) => {
  log(`motion ${kind}`, JSON.stringify(rec ?? { missing: kind, seen: kinds }))
  if (!rec) throw new Error(`no ${kind} overlay appeared (seen: ${kinds.join(", ")})`)
  const show = (a) => `${a.phase} ${a.duration}ms ${a.easing}${a.css ? ` css:${a.css} keyframes:${a.kfEasing.join("/")}` : ""} [${a.props.join(",")}]`
  const fail = []
  const inA = rec.anims.find((a) => a.phase === "enter" && a.props.includes("opacity"))
  const outA = rec.anims.find((a) => a.phase === "exit" && a.props.includes("opacity"))
  if (!inA || Math.abs(inA.duration - enter) > 2 || inA.easing !== DECEL) fail.push(`enter should be ${enter}ms ${DECEL}`)
  // the browser runs one animation per property: the move is its own
  const inMove = rec.anims.find((a) => a.phase === "enter" && moves && a.props.includes(moves))
  if (moves && (!inMove || Math.abs(inMove.duration - enter) > 2 || inMove.easing !== DECEL)) fail.push(`enter should move (${moves}) for ${enter}ms ${DECEL}`)
  if (!outA || Math.abs(outA.duration - exit) > 2 || outA.easing !== ACCEL) fail.push(`exit should be ${exit}ms ${ACCEL}`)
  // at rest it is whole: opaque and at full size (CI 45952006402: menus came to rest at scale(0))
  // (full size within a thousandth: an enter sampled on its last frame reads matrix(0.999995, …), CI 45977107041)
  const whole = (t) => t === "none" || (/^matrix\(/.test(t) && t.slice(7, -1).split(",").map(Number).every((x, i) => Math.abs(x - [1, 0, 0, 1, 0, 0][i]) < 0.001))
  if (!rec.rest || rec.rest[1] < 0.99 || !whole(rec.rest[2])) fail.push(`at rest it is ${JSON.stringify(rec.rest)}, not opaque at full size`)
  if (rec.closedAt === null || rec.removedAt === null) fail.push(`closed at ${rec.closedAt}, removed at ${rec.removedAt}`)
  else if (rec.removedAt - rec.closedAt < exit - 10) fail.push(`removed ${rec.removedAt - rec.closedAt}ms after it was told to close, before its ${exit}ms exit ran`)
  env.report = { ...(env.report ?? {}), [kind]: { enter: inA?.duration ?? null, exit: outA?.duration ?? null, closeToRemoved: rec.removedAt !== null && rec.closedAt !== null ? rec.removedAt - rec.closedAt : null } }
  if (fail.length) throw new Error(`${kind}: ${fail.join("; ")}. Recorded: ${rec.anims.map(show).join(" | ") || "no animation"}`)
}
const openNewMenu = async (page) => {
  await go(page, `${MOUNT}/文档`)
  await page.locator("[data-files-new]").click()
  await page.locator('[role="menuitem"][data-action="mkdir"]').waitFor()
  await page.waitForTimeout(400)
}
// dialog 200/150 (MD3 emphasized), menu 120/90; the menu closes as its item opens the dialog
await spec("motion-dialog-and-menu", { init: overlayProbe, video: true }, async (env) => {
  const { page } = env
  await openNewMenu(page)
  await page.locator('[role="menuitem"][data-action="mkdir"]').click()
  await page.locator('[role="dialog"]').first().waitFor()
  await page.waitForTimeout(600)
  await page.keyboard.press("Escape")
  await page.waitForTimeout(800)
  const menu = await overlayRecord(page, "menu")
  const dialog = await overlayRecord(page, "dialog")
  const errs = []
  for (const [k, r, a, b, m] of [["menu", menu, 120, 90, "transform"], ["dialog", dialog, 200, 150, "transform"]]) {
    try {
      expectOverlayMotion(env, k, r, a, b, m)
    } catch (e) {
      errs.push(e.message)
    }
  }
  if (errs.length) throw new Error(errs.join("\n"))
})
await spec("motion-context-menu", { init: overlayProbe }, async (env) => {
  const { page } = env
  await go(page, `${MOUNT}/文档`)
  await item(page, "笔记").click({ button: "right" })
  await page.locator('[role="menu"]').first().waitFor()
  await page.waitForTimeout(400)
  await page.keyboard.press("Escape")
  await page.waitForTimeout(500)
  expectOverlayMotion(env, "menu", await overlayRecord(page, "menu"), 120, 90, "transform")
})
// the phone's Me sheet: 250/200, sliding up from the bottom edge
await spec("motion-sheet", { ...PHONE, init: overlayProbe, video: true }, async (env) => {
  const { page } = env
  await go(page, `${MOUNT}/文档`)
  await page.getByRole("button", { name: /^(Me|我的?)$/ }).click()
  await page.locator('[role="dialog"]').first().waitFor()
  await page.waitForTimeout(700)
  await page.keyboard.press("Escape")
  await page.waitForTimeout(800)
  expectOverlayMotion(env, "sheet", await overlayRecord(page, "sheet"), 250, 200, "transform")
})
// a dropdown (Select) of a settings form: 120/90 like a menu
await spec("motion-select", { init: overlayProbe, video: true }, async (env) => {
  const { page } = env
  // a dropdown of a dialog: the local settings (the share form's order of the
  // files has no dropdown since P2)
  await go(page, `${MOUNT}/文档`)
  await page.locator("[data-files-more]").click()
  await page.getByRole("menuitem", { name: tr("home.toolbar.local_settings") }).first().click()
  await page.locator('[role="dialog"] button[aria-haspopup="listbox"]').first().click()
  await page.locator('[role="listbox"]').first().waitFor()
  await page.waitForTimeout(500)
  await page.keyboard.press("Escape")
  await page.waitForTimeout(600)
  expectOverlayMotion(env, "select", await overlayRecord(page, "select"), 120, 90, "transform")
})
await spec("motion-tooltip", { init: overlayProbe }, async (env) => {
  const { page } = env
  await go(page, `${MOUNT}/文档`)
  await page.getByRole("button", { name: tr("shell.task_center.title") }).first().hover()
  await page.locator('[role="tooltip"]').first().waitFor({ timeout: 3000 })
  await page.waitForTimeout(400)
  await page.mouse.move(1, 1)
  await page.waitForTimeout(800)
  expectOverlayMotion(env, "tooltip", await overlayRecord(page, "tooltip"), 120, 90, "transform")
})
await spec("motion-palette", { init: overlayProbe }, async (env) => {
  const { page } = env
  await go(page, `${MOUNT}/文档`)
  await page.keyboard.press("Control+k")
  await page.locator('[role="dialog"]').first().waitFor()
  await page.waitForTimeout(500)
  await page.keyboard.press("Escape")
  await page.waitForTimeout(600)
  expectOverlayMotion(env, "dialog", await overlayRecord(page, "dialog"), 200, 150, "transform")
})
// the share form folds the order of the files (research 05 §二.3): the height
// opens in 220ms after a 40ms lead and folds in 180ms, the body fades
// 220/180 on the standard curve; folded, it is hidden
const STANDARD = "cubic-bezier(0.2,0,0,1)"
/**
 * How long the height moved after `from`, as frames can tell it: at most from
 * its last resting frame to its first settled one (`ran`), at least from its
 * first moving frame to its last (`moved`). A frame drawn late widens the
 * first and not the second (CI 46019775151: ran 255 for a 220ms run).
 */
const heightRun = (frames, from, to) => {
  const span = frames.filter((f) => f[0] >= from && f[0] < to)
  const h = span.map((f) => f[3])
  const end = h[h.length - 1]
  const startIdx = h.findIndex((v) => v !== h[0])
  const endIdx = h.findIndex((v, i) => i >= startIdx && v === end)
  if (startIdx < 1 || endIdx < 0) return null
  const t = (i) => span[i][0]
  return {
    lead: t(startIdx - 1) - from,
    ran: t(endIdx) - t(startIdx - 1),
    moved: t(endIdx - 1) - t(startIdx),
    frames: span.slice(Math.max(0, startIdx - 2), endIdx + 2).map((f) => [f[0] - from, f[3]]),
    from: h[0],
    to: end,
  }
}
/** A run of `ms` fits what the frames saw (one frame's rounding either side). */
const ranFor = (run, ms) => !!run && run.moved - 2 <= ms && ms <= run.ran + 2
await spec("motion-collapsible", { init: overlayProbe, video: true }, async (env) => {
  const { page } = env
  await go(page, "/@manage/shares/add", 1500)
  const trigger = page.locator('[data-testid="share-order-group"]')
  if ((await trigger.getAttribute("aria-expanded")) !== "false") throw new Error("a new share should open with the order of the files folded")
  await trigger.click()
  await page.waitForTimeout(800)
  await trigger.click()
  await page.waitForTimeout(800)
  const rec = await page.evaluate(() => window.__overlayMotion.filter((r) => r.kind === "collapsible").pop())
  const hidden = await page.locator('[data-motion="collapsible"]').evaluate((e) => e.hidden)
  const marks = rec?.marks ?? []
  const opened = marks.find((m) => m[1] === "expanded")
  const closed = marks.find((m) => m[1] === "closed" && opened && m[0] > opened[0])
  const enter = opened && closed ? heightRun(rec.frames, opened[0], closed[0]) : null
  const exit = closed ? heightRun(rec.frames, closed[0], Infinity) : null
  const fadeIn = rec?.anims.find((a) => a.phase === "enter" && a.target === "child" && a.props.includes("opacity"))
  const fadeOut = rec?.anims.find((a) => a.phase === "exit" && a.target === "child" && a.props.includes("opacity"))
  env.report = { ...(env.report ?? {}), collapsible: { enterHeight: enter, exitHeight: exit, fadeIn: fadeIn?.duration ?? null, fadeOut: fadeOut?.duration ?? null } }
  log("motion collapsible", JSON.stringify({ marks, enter, exit, anims: rec?.anims, hidden }))
  const bad = []
  // the height runs on Motion's JS clock: measured by frame (heightRun)
  if (!ranFor(enter, 220) || enter.lead < 24) bad.push(`height should open in 220ms after 40ms: ${JSON.stringify(enter)}`)
  if (!ranFor(exit, 180) || exit.to !== 0) bad.push(`height should fold in 180ms to 0: ${JSON.stringify(exit)}`)
  if (!fadeIn || Math.abs(fadeIn.duration - 220) > 2 || fadeIn.easing !== STANDARD) bad.push(`body should fade in 220ms ${STANDARD}`)
  if (!fadeOut || Math.abs(fadeOut.duration - 180) > 2 || fadeOut.easing !== STANDARD) bad.push(`body should fade out 180ms ${STANDARD}`)
  if (!hidden) bad.push("folded content is not hidden")
  if (bad.length) throw new Error(bad.join("; "))
})
// a share whose order was changed opens with it unfolded and says how many changed
await spec("share-order-group-default", {}, async (env) => {
  const { page } = env
  const created = await fetch(OL + "/api/share/create", {
    method: "POST",
    headers: { Authorization: token, "Content-Type": "application/json" },
    body: JSON.stringify({ files: [`${MOUNT}/文档`], pwd: "", expires: null, max_accessed: 0, burn_after_read: false, order_by: "size", order_direction: "desc", extract_folder: "", remark: "order group", readme: "", header: "" }),
  }).then((r) => r.json())
  const id = created?.data?.id
  if (!id) throw new Error(`could not create a share: ${JSON.stringify(created)}`)
  const bad = []
  for (const [sid, open, changed] of [[shares.open, "false", null], [id, "true", 2]]) {
    await go(page, `/@manage/shares/edit/${sid}`, 1500)
    const g = page.locator('[data-testid="share-order-group"]')
    const state = await g.getAttribute("aria-expanded")
    const mark = await g.locator('[data-testid="changed-mark"]').innerText().catch(() => "")
    log("share order group", JSON.stringify({ sid, state, mark }))
    if (state !== open) bad.push(`share ${sid}: expanded ${state}, want ${open}`)
    if (changed && !mark.includes(String(changed))) bad.push(`share ${sid}: changed mark "${mark}", want ${changed}`)
    if (!changed && mark) bad.push(`share ${sid}: has a changed mark "${mark}"`)
  }
  if (bad.length) throw new Error(bad.join("; "))
})

// reduced motion (system setting): what moves becomes a fade of at most 100ms,
// nothing translates or scales; CSS transitions stop
for (const size of [{}, PHONE]) {
  await spec("motion-reduced", { ...size, reducedMotion: "reduce", init: overlayProbe }, async (env) => {
    const { page } = env
    const phone = size === PHONE
    await go(page, `${MOUNT}/文档`)
    if (phone) await page.getByRole("button", { name: /^(Me|我的?)$/ }).click()
    else {
      await page.locator("[data-files-new]").click()
      await page.locator('[role="menuitem"][data-action="mkdir"]').click()
    }
    await page.locator('[role="dialog"]').first().waitFor()
    await page.waitForTimeout(500)
    await page.keyboard.press("Escape")
    await page.waitForTimeout(500)
    const recs = await page.evaluate(() => window.__overlayMotion.map((r) => ({ kind: r.kind, anims: r.anims, moved: r.frames.filter((f) => f[2] !== "none" && f[2] !== "matrix(1, 0, 0, 1, 0, 0)").slice(0, 3) })))
    const transition = await page.evaluate(() => {
      const b = document.querySelector("[data-palette-trigger], [data-files-new]")
      return b ? getComputedStyle(b).transitionDuration : "none"
    })
    log("reduced motion", JSON.stringify({ recs, transition }))
    const bad = []
    for (const r of recs) {
      for (const a of r.anims) {
        if (a.duration > 100) bad.push(`${r.kind} ${a.phase} runs ${a.duration}ms`)
        const moving = a.props.filter((p) => p !== "opacity")
        if (moving.length) bad.push(`${r.kind} ${a.phase} animates ${moving.join(",")}`)
      }
      if (r.moved.length) bad.push(`${r.kind} is transformed: ${r.moved.map((f) => f[2]).join(" ")}`)
    }
    if (!recs.some((r) => r.anims.length)) bad.push("no overlay faded at all")
    if (transition !== "none" && transition.split(",").some((s) => parseFloat(s) > 0.0001)) bad.push(`CSS transitions still run (${transition})`)
    if (bad.length) throw new Error(bad.join("; "))
  })
}

// ---- P1.4 the rest of the 6575087 audit
// error center on a phone: the Me tab shows the unread errors, and the center
// is two taps away (Me, then Errors)
const unreadError = () =>
  localStorage.setItem(
    "error-center:admin",
    JSON.stringify([{ id: "probe-1", at: Date.now(), category: "network", source: "probe", message: "示例错误", read: false, count: 1 }]),
  )
await spec("error-center-phone", { ...PHONE, init: unreadError }, async (env) => {
  const { page } = env
  await go(page, `${MOUNT}/文档`)
  const me = page.getByRole("button", { name: /^(Me|我的?)/ }).last()
  const tab = await me.evaluate((b) => ({ text: b.textContent.trim(), badge: [...b.querySelectorAll("[aria-label], span")].map((s) => s.getAttribute("aria-label") || "").filter(Boolean) }))
  log("me tab", JSON.stringify(tab))
  if (!/1/.test(tab.text) && !tab.badge.some((l) => /1/.test(l))) throw new Error(`the Me tab does not show the unread error: "${tab.text}"`)
  await me.click()
  await page.locator("[data-error-center-trigger]").filter({ visible: true }).first().click()
  await page.getByText(tr("shell.error_center.mark_all_read")).first().waitFor({ timeout: 3000 }).catch(() => {
    throw new Error("Me, then Errors, did not open the error center")
  })
})

// dashboard: no fractional bytes on the chart axes, the figures in the body
// font, and the favorites card is whole once the page is scrolled to its end
const canvasText = () => {
  window.__canvasText = []
  const orig = CanvasRenderingContext2D.prototype.fillText
  CanvasRenderingContext2D.prototype.fillText = function (t, ...a) {
    window.__canvasText.push(String(t))
    return orig.call(this, t, ...a)
  }
}
for (const width of [1440, 820]) {
  await spec("dashboard-figures", { width, height: width === 820 ? 1100 : 900, init: canvasText }, async (env) => {
    const { page } = env
    await go(page, "/@dashboard", 2500)
    const m = await page.evaluate(() => {
      const fig = document.querySelector('[data-testid="dashboard-traffic"] [data-period] .font-semibold, [data-testid="dashboard-traffic"] [data-period] [data-figure]')
      const title = document.querySelector('[data-testid="dashboard-traffic"]')
      const texts = [...new Set(window.__canvasText)]
      return {
        axis: texts.filter((s) => /^\d*\.\d+\s*B(\/s)?$/.test(s)),
        sample: texts.slice(0, 30),
        figFont: fig ? getComputedStyle(fig).fontFamily : null,
        bodyFont: title ? getComputedStyle(title).fontFamily : null,
        note: document.body.innerText.includes("Relayed by"),
      }
    })
    // the end of the page: every card's bottom and the unread-errors line in view
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    await page.waitForTimeout(500)
    const fav = await page.evaluate(() => {
      const card = document.querySelector('[data-testid="dashboard-favorites"]')
      const mask = document.querySelector("[data-shell-mask]")
      const unread = document.querySelector('[data-testid="dashboard-unread-errors"]')
      const c = card.getBoundingClientRect()
      const bottom = mask ? mask.getBoundingClientRect().bottom : innerHeight
      const u = unread?.getBoundingClientRect()
      return { card: `${Math.round(c.top)}..${Math.round(c.bottom)}`, cardCut: c.bottom > bottom + 1, viewBottom: Math.round(bottom), unread: u ? `${Math.round(u.top)}..${Math.round(u.bottom)} h${Math.round(u.height)}` : null, unreadOut: !!u && (u.bottom > c.bottom + 1 || u.bottom > bottom + 1), unreadSmall: !!u && u.height < 32 }
    })
    log(`dashboard ${width}`, JSON.stringify({ ...m, fav }))
    const bad = []
    if (m.axis.length) bad.push(`chart axis shows fractional bytes: ${m.axis.join(", ")}`)
    if (!m.figFont || /mono/i.test(m.figFont) || m.figFont !== m.bodyFont) bad.push(`traffic figures are in "${m.figFont}", the card in "${m.bodyFont}"`)
    if (m.note) bad.push('the "Relayed by this node…" note is still there')
    if (fav.cardCut) bad.push(`the favorites card (${fav.card}) is cut at ${fav.viewBottom} with the page scrolled to its end`)
    if (fav.unreadOut) bad.push(`the unread-errors line (${fav.unread}) is outside the card (${fav.card})`)
    if (fav.unreadSmall) bad.push(`the unread-errors line is ${fav.unread} tall, under 32px to click`)
    if (bad.length) throw new Error(bad.join("; "))
  })
}

// media manage at 820: the table header sits above the rows, never over them
// a list whose table scrolls inside its card does not widen the page
// (audit 45956655215: page-hscroll on the shares, storages and media lists)
for (const width of [820, 1440]) {
  await spec("manage-lists-page-width", { width }, async (env) => {
    const { page } = env
    const bad = []
    for (const p of ["/@manage/shares", "/@manage/storages", "/@manage/media/video"]) {
      await go(page, p, 1500)
      await page.locator('[data-layout="table"]').first().waitFor({ timeout: 6000 })
      const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: innerWidth, scrolls: !!document.querySelector("[data-layout=table][data-scrolls]") }))
      log("page width", p, JSON.stringify(m))
      if (m.sw > m.w + 1) bad.push(`${p}: scrollWidth ${m.sw} > ${m.w}${m.scrolls ? " (its table scrolls in the card)" : ""}`)
    }
    if (bad.length) throw new Error(bad.join("; "))
  })
}
await spec("manage-media-table-820", { width: 820, height: 1100 }, async (env) => {
  const { page } = env
  await go(page, "/@manage/media/video", 2000)
  const card = page.locator('[data-layout="table"]').first()
  await card.waitFor({ timeout: 6000 })
  const m = await card.evaluate((c) => {
    const head = c.querySelector("thead").getBoundingClientRect()
    const row = c.querySelector("tbody tr").getBoundingClientRect()
    const over = []
    for (const th of c.querySelectorAll("th"))
      for (const td of c.querySelectorAll("td")) {
        const a = th.getBoundingClientRect()
        const b = td.getBoundingClientRect()
        if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2) over.push(`"${th.textContent.trim()}" over "${td.textContent.trim().slice(0, 16)}"`)
      }
    return { head: `${Math.round(head.top)}..${Math.round(head.bottom)}`, row: `${Math.round(row.top)}..${Math.round(row.bottom)}`, below: row.top >= head.bottom - 1, over: over.slice(0, 5), scrolls: c.hasAttribute("data-scrolls") }
  })
  log("media table 820", JSON.stringify(m))
  if (!m.below || m.over.length) throw new Error(`the header (${m.head}) overlaps the first row (${m.row}): ${m.over.join("; ")}`)
})

// long names in the list: the name's visible box ends before the size and
// date columns, and the audit's text-overlap check agrees
for (const width of [820, 1440]) {
  await spec("files-longnames-list", { width, height: width === 820 ? 1100 : 900 }, async (env) => {
    const { page } = env
    await go(page, `${MOUNT}/长文件名`)
    await page.locator("[data-files-view]").click()
    await page.getByRole("menuitem", { name: tr("home.layouts.list") }).first().click()
    await page.waitForTimeout(900)
    const m = await page.evaluate(() =>
      [...document.querySelectorAll(".list-item")].map((rowEl) => {
        const name = rowEl.querySelector(".name")
        let [l, r] = [name.getBoundingClientRect().left, name.getBoundingClientRect().right]
        for (let a = name.parentElement; a && a !== rowEl; a = a.parentElement) {
          if (getComputedStyle(a).overflowX === "visible") continue
          const b = a.getBoundingClientRect()
          ;[l, r] = [Math.max(l, b.left), Math.min(r, b.right)]
        }
        const cols = [rowEl.querySelector(".size"), rowEl.querySelector(".modified")].filter(Boolean).map((e) => e.getBoundingClientRect().left)
        return { name: name.textContent.slice(0, 12), right: Math.round(r), cols: cols.map(Math.round), over: cols.some((c) => r > c + 1) }
      }),
    )
    const checks = await page.evaluate(layoutChecks)
    const overlaps = checks.findings.filter((f) => f.type === "text-overlap")
    log(`long names ${width}`, JSON.stringify({ rows: m, textOverlap: checks.counts["text-overlap"] ?? 0, overlaps }))
    if (!m.length) throw new Error("no rows")
    const bad = m.filter((r) => r.over)
    if (bad.length) throw new Error("names run into the size/date columns: " + bad.map((r) => `${r.name} to ${r.right}, columns at ${r.cols}`).join("; "))
    if (overlaps.length) throw new Error(`the audit reports ${checks.counts["text-overlap"]} text overlaps: ${overlaps.map((f) => f.detail).join("; ")}`)
  })
}

// 390: the current folder's name in the path strip is whole next to the library badge
await spec("phone-crumb-library-name", PHONE, async (env) => {
  const { page } = env
  await go(page, `${MOUNT}/媒体库`, 2000)
  const m = await page.evaluate(() => {
    const btn = document.querySelector("[data-files-current]")
    const label = [...btn.querySelectorAll("span")].pop()
    const badge = document.querySelector("[data-library-badge]")
    const a = label.getBoundingClientRect()
    const b = badge?.getBoundingClientRect()
    let cut = label.scrollWidth > label.clientWidth + 1
    for (let e = label; e && e !== btn.parentElement; e = e.parentElement) if (e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX !== "visible") cut = true
    return { text: label.textContent, label: `${Math.round(a.left)}..${Math.round(a.right)}`, badge: b ? `${Math.round(b.left)}..${Math.round(b.right)}` : null, cut, under: !!b && a.right > b.left + 1 && a.left < b.right }
  })
  log("phone crumb", JSON.stringify(m))
  if (m.cut || m.under) throw new Error(`"${m.text}" is ${m.cut ? "cut" : ""}${m.under ? ` under the badge (${m.label} vs ${m.badge})` : ""}`)
})

// grid cards: the border is told from both the card and what is around it by
// more than the audit's border-faint threshold (24 in a channel)
for (const theme of ["light", "dark"]) {
  await spec("grid-card-edge", { theme }, async (env) => {
    const { page } = env
    await go(page, MOUNT, 1200)
    await page.locator("[data-files-view]").click()
    await page.getByRole("menuitem", { name: tr("home.layouts.grid") }).first().click()
    await page.waitForTimeout(900)
    const checks = await page.evaluate(layoutChecks)
    const cards = checks.findings.filter((f) => /^(border-faint|border-invisible)$/.test(f.type) && /grid-card/.test(f.el))
    log(`grid card edge ${theme}`, JSON.stringify(cards))
    if (!(await page.locator(".grid-item.grid-card").count())) throw new Error("no grid cards")
    if (cards.length) throw new Error(`${cards.length} grid cards with a faint edge: ${cards[0].detail}`)
  })
}

// filter chips, the media section nav, the favourite stars and row checks: no
// border that cannot be seen; and every control there at least 32px
const AUDIT_PAGES = ["/@media", "/@media/video", "/@media/music", "/@manage/media/video", "/@transfers"]
for (const theme of ["light", "dark"]) {
  await spec("border-invisible", { theme }, async (env) => {
    const { page } = env
    const bad = []
    for (const p of AUDIT_PAGES) {
      await go(page, p, 1500)
      const c = await page.evaluate(layoutChecks)
      const f = c.findings.filter((x) => x.type === "border-invisible")
      if (f.length) bad.push(`${p}: ${c.counts["border-invisible"]} (${[...new Set(f.map((x) => x.el.replace(/ @.*$/, "")))].slice(0, 3).join("; ")})`)
    }
    await go(page, `${MOUNT}/文档`)
    await selectRows(page, "笔记", false)
    const c = await page.evaluate(layoutChecks)
    if (c.counts["border-invisible"]) bad.push(`selected row: ${c.counts["border-invisible"]} (${c.findings.filter((x) => x.type === "border-invisible").map((x) => x.el.replace(/ @.*$/, ""))[0]})`)
    log(`border-invisible ${theme}`, JSON.stringify(bad))
    if (bad.length) throw new Error(bad.join(" | "))
  })
}
const smallControls = (page) =>
  page.evaluate(() => {
    const root = document.querySelector("[data-shell-content]") || document.body
    const sel = 'button, a[href], [role="button"], [role="tab"], [role="switch"], [role="checkbox"], select, input:not([type="hidden"])'
    const out = []
    for (const el of root.querySelectorAll(sel)) {
      const r = el.getBoundingClientRect()
      const cs = getComputedStyle(el)
      if (r.width < 1 || r.height < 1 || cs.visibility !== "visible" || r.bottom < 0 || r.top > innerHeight) continue
      if (el.tagName === "A" && cs.display === "inline" && el.closest("p")) continue
      if (r.width < 32 || r.height < 32) out.push(`${(el.getAttribute("aria-label") || el.textContent || el.tagName).trim().slice(0, 20)} ${Math.round(r.width)}x${Math.round(r.height)}`)
    }
    return out
  })
for (const size of [{}, PHONE]) {
  await spec("click-targets-media", size, async (env) => {
    const { page } = env
    const bad = []
    for (const p of ["/@media", "/@media/video", "/@transfers"]) {
      await go(page, p, 1500)
      const s = await smallControls(page)
      if (s.length) bad.push(`${p}: ${s.length} (${[...new Set(s)].slice(0, 6).join("; ")})`)
    }
    log("small controls", JSON.stringify(bad))
    if (bad.length) throw new Error(bad.join(" | "))
  })
}
await spec("click-targets-login", {}, async (env) => {
  const { page, ctx } = env
  await ctx.clearCookies()
  await page.goto(OL + "/@login", { waitUntil: "domcontentloaded" })
  await page.evaluate(() => localStorage.removeItem("token"))
  await page.goto(OL + "/@login", { waitUntil: "domcontentloaded" })
  await page.waitForTimeout(1500)
  const link = page.getByText(tr("login.forget")).first()
  const b = await link.evaluate((e) => {
    const a = e.closest("a") ?? e
    const r = a.getBoundingClientRect()
    return { w: Math.round(r.width), h: Math.round(r.height) }
  })
  log("forget password link", JSON.stringify(b))
  if (b.w < 32 || b.h < 32) throw new Error(`"Forget password?" is ${b.w}x${b.h}`)
})

// ---- P1.3 texts: dropdowns show what an empty choice does; 0 reads as its meaning
const triggerTexts = (scope) =>
  scope.evaluate((d) => [...d.querySelectorAll('button[aria-haspopup="listbox"]')].map((b) => b.innerText.trim()))
// The order of the files is one control since P2 (plan §0.2 分享弹窗): its
// empty choices still read as what they do.
const ORDER_DEFAULTS = ["shares.extract_folder_default", "shares.order_by_default", "shares.order_direction_default"]
const orderText = (scope) => scope.locator('[data-testid="share-order"]').first().innerText().catch(() => "")
await spec("texts-share-dialog", {}, async (env) => {
  const { page } = env
  fire(await ctxEntry(page, MOUNT, "文档", "share"))
  await expectDialog(env, "share")
  const dialog = page.locator('[role="dialog"]').first()
  await dialog.locator('[data-testid="advanced-page"]').click()
  await page.waitForTimeout(500)
  const texts = await triggerTexts(dialog)
  const order = await orderText(dialog)
  const max = await dialog.locator('input[type="number"]').first().evaluate((i) => ({ value: i.value, placeholder: i.placeholder })).catch(() => null)
  log("share dialog texts", JSON.stringify({ texts, order, max }))
  const bad = []
  if (texts.some((s) => tr("global.choose").test(s) && s.length < 10)) bad.push(`a dropdown says "${texts.find((s) => tr("global.choose").test(s))}"`)
  for (const k of ORDER_DEFAULTS) if (!tr(k).test(order)) bad.push(`the order of the files does not show ${tr(k)}: "${order}"`)
  if (!max || max.value !== "" || !tr("shares.max_accessed_unlimited").test(max.placeholder)) bad.push(`max visits shows "${max?.value}" / placeholder "${max?.placeholder}", not "Unlimited"`)
  if (bad.length) throw new Error(bad.join("; "))
})
await spec("texts-share-form", {}, async (env) => {
  const { page } = env
  await go(page, "/@manage/shares/add", 1500)
  // the order of the files is folded on a new share
  await page.locator('[data-testid="share-order-group"]').click()
  await page.waitForTimeout(500)
  const texts = await triggerTexts(page.locator("body"))
  const order = await orderText(page)
  const max = await page.locator("#max_accessed").evaluate((i) => ({ value: i.value, placeholder: i.placeholder }))
  const expires = await page.locator("#expires").getAttribute("placeholder")
  log("share form", JSON.stringify({ texts, order, max, expires }))
  const bad = []
  for (const k of ORDER_DEFAULTS) if (!tr(k).test(order)) bad.push(`the order of the files does not show ${tr(k)}: "${order}"`)
  if (texts.some((s) => tr("global.choose").test(s) && s.length < 10)) bad.push("a dropdown says Choose")
  if (max.value !== "" || !tr("shares.max_accessed_unlimited").test(max.placeholder)) bad.push(`max visits "${max.value}" / "${max.placeholder}"`)
  if (!tr("shares.expires_never").test(expires ?? "")) bad.push(`expires placeholder "${expires}"`)
  if (bad.length) throw new Error(bad.join("; "))
})

// The share dialog's order of the files (plan §0.2 分享弹窗): the basis as
// buttons, the direction beside it, folders on top as a switch; the share made
// keeps all three. The share's address comes from the link the dialog shows.
await spec("share-dialog-order", {}, async (env) => {
  const { page } = env
  fire(await ctxEntry(page, MOUNT, "文档", "share"))
  await expectDialog(env, "share")
  const dialog = page.locator('[role="dialog"]').first()
  await dialog.locator('[data-testid="advanced-page"]').click()
  const order = dialog.locator('[data-testid="share-order"]')
  await order.waitFor({ timeout: 3000 })
  const direction = order.locator('[data-testid="share-order-direction"]')
  const bad = []
  if (!(await direction.isDisabled())) bad.push("the direction can be changed while the order is the storage's own")
  await order.locator('[data-segment="size"]').click()
  await direction.click()
  await order.locator("label").filter({ hasText: tr("shares.extract_folders.front") }).first().click()
  const mark = await dialog.locator('[data-testid="advanced-page"] [data-testid="changed-mark"]').innerText().catch(() => "")
  if (!mark.includes("3")) bad.push(`the group does not say 3 changed: "${mark}"`)
  await dialog.locator('[data-testid="share-create"]').click()
  const text = await dialog.locator('[data-testid="share-link"]').inputValue({ timeout: 8000 }).catch(() => "")
  const id = decodeURIComponent(text.match(/\/@s\/([^\s/?#]+)/)?.[1] ?? "")
  const got = id ? await fetch(OL + `/api/share/get?id=${encodeURIComponent(id)}`, { headers: { Authorization: token } }).then((r) => r.json()) : null
  const d = got?.data ?? {}
  log("share dialog order", JSON.stringify({ id, mark, order_by: d.order_by, order_direction: d.order_direction, extract_folder: d.extract_folder }))
  if (!id) bad.push(`no share link shown: "${text.slice(0, 120)}"`)
  else if (d.order_by !== "size" || String(d.order_direction).toLowerCase() !== "desc" || d.extract_folder !== "front") bad.push(`the share keeps ${JSON.stringify({ order_by: d.order_by, order_direction: d.order_direction, extract_folder: d.extract_folder })}`)
  if (bad.length) throw new Error(bad.join("; "))
})

// ---- P2 the viewer and downloads (docs/PLAN_FE_SYSTEM_UX_1127.md P2). The
// prototype's 41 checks (scripts/ui-compare/viewer-proto.mjs, run 45866187867)
// on the product's own file pages: a file opens over its folder (the docked
// player for video, viewers for the rest), the address follows, and every file
// downloads from where it is listed.
const VDIR = `${MOUNT}/查看器`
const SEASON = `${MOUNT}/媒体库/剧集乙 (2021)/Season 1`
const V1 = "01 示例视频.mp4"
const V2 = "02 示例视频.mp4"
const V3 = "03 示例视频.mp4"
const IMG1 = "照片_01.jpg"
const IMG2 = "照片_02.jpg"
const TEXT = "长文本.txt"
const PDF = "报告.pdf"
const UNKNOWN = "数据.bin"
const DOCK = '[data-testid="dock"]'
const DOCK_OPEN = `${DOCK}[data-open="true"]`
const DOCK_CLOSED = `${DOCK}[data-open="false"]`
const DOCK_MINI = `${DOCK}[data-mini="true"]`
/** The closed dock is 0px high: it is never "visible", only there. */
const closedDock = (page, timeout = 5000) => page.waitForSelector(DOCK_CLOSED, { state: "attached", timeout }).then(() => true, () => false)
/** The "Playing" mark of a row (the open file's row is also the router's aria-current page). */
const playingMark = (page, name) => item(page, name).locator('[data-testid="playing-badge"]').count()

// Counts every <movi-player> put into and taken out of the page, every Web
// Animation that starts (with the data-motion of the element it moves) and the
// docked player's height per frame (its height runs on Motion's JS clock).
const viewerProbe = () => {
  const v = (window.__viewer = { added: 0, removed: 0, anims: [], heights: [] })
  const movi = (n) => n.nodeType === 1 && (n.localName === "movi-player" || !!n.querySelector?.("movi-player"))
  new MutationObserver((ms) => {
    for (const m of ms) {
      for (const n of m.addedNodes) if (movi(n)) v.added++
      for (const n of m.removedNodes) if (movi(n)) v.removed++
    }
  }).observe(document, { childList: true, subtree: true })
  const seen = new WeakSet()
  const t0 = performance.now()
  const frame = () => {
    for (const a of document.getAnimations()) {
      if (seen.has(a)) continue
      seen.add(a)
      const el = a.effect?.target
      const kf = a.effect?.getKeyframes?.() ?? []
      const tm = a.effect?.getTiming?.() ?? {}
      v.anims.push({
        at: Math.round(performance.now() - t0),
        motion: el?.closest?.("[data-motion]")?.getAttribute("data-motion") ?? el?.localName ?? "",
        // the marked element itself, not something inside it (a hover there)
        own: !!el?.hasAttribute?.("data-motion"),
        pseudo: a.effect?.pseudoElement ?? "",
        duration: Number(tm.duration),
        delay: Number(tm.delay) || 0,
        iterations: Number(tm.iterations),
        easing: String(tm.easing).replace(/\s+/g, ""),
        props: [...new Set(kf.flatMap((f) => Object.keys(f)))].filter((p) => !["offset", "easing", "composite", "computedOffset"].includes(p)),
      })
    }
    const d = document.querySelector('[data-testid="dock"]')
    if (d) {
      const h = Math.round(d.getBoundingClientRect().height)
      const last = v.heights[v.heights.length - 1]
      // on the page's clock, as the specs' marks around a run are
      if (!last || last[1] !== h) v.heights.push([Math.round(performance.now()), h])
    }
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
}
/** Checks of one spec, all run; the spec fails with the list of those that did not hold. */
const checker = (env) => {
  const list = []
  const c = (name, ok, detail) => {
    list.push({ name, ok: !!ok, ...(detail === undefined ? {} : { detail: typeof detail === "string" ? detail : JSON.stringify(detail) }) })
    log(ok ? "  ok" : "  NO", name, detail === undefined ? "" : typeof detail === "string" ? detail : JSON.stringify(detail))
  }
  c.done = () => {
    env.report = { ...(env.report ?? {}), checks: list }
    const bad = list.filter((x) => !x.ok)
    if (bad.length) throw new Error(`${bad.length}/${list.length} checks failed: ${bad.map((x) => `${x.name}${x.detail ? ` (${x.detail.slice(0, 160)})` : ""}`).join("; ")}`)
  }
  return c
}
const pathOf = (page) => decodeURI(new URL(page.url()).pathname)
const histLen = (page) => page.evaluate(() => history.length)
const seen = (page, sel, timeout = 5000) => page.waitForSelector(sel, { timeout }).then(() => true, () => false)
const gone = (page, sel, timeout = 5000) => page.waitForSelector(sel, { state: "detached", timeout }).then(() => true, () => false)
/** Finite animations have ended (movi's spinners run forever). */
const settle = (page) =>
  page
    .waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running" || a.effect?.getComputedTiming().iterations === Infinity), undefined, { timeout: 15000 })
    .catch(() => log("animations still running after 15s"))
const scrollY = (page, y) =>
  page.evaluate((y) => new Promise((done) => {
    window.scrollTo(0, y)
    // the IntersectionObserver reports in the frames after the scroll
    requestAnimationFrame(() => requestAnimationFrame(() => done()))
  }), y)
const movi = (page) =>
  page.evaluate(() => {
    const all = document.querySelectorAll("movi-player")
    const el = all[0]
    return {
      count: all.length,
      added: window.__viewer?.added ?? -1,
      removed: window.__viewer?.removed ?? -1,
      src: el ? el.getAttribute("src") || [...el.querySelectorAll("source")].map((s) => s.getAttribute("src")).join("|") : "",
      tracks: el ? el.querySelectorAll("track").length : 0,
      fullscreen: !!el && document.fullscreenElement === el,
      t: el?.currentTime ?? 0,
    }
  })
const playing = (page) =>
  page.waitForFunction(() => (document.querySelector("movi-player")?.currentTime ?? 0) > 0.3, undefined, { timeout: 60000 }).then(() => true, () => false)
const srcChanged = (page, from, timeout = 10000) =>
  page
    .waitForFunction((from) => {
      const el = document.querySelector("movi-player")
      const now = el ? el.getAttribute("src") || [...el.querySelectorAll("source")].map((s) => s.getAttribute("src")).join("|") : ""
      return now && now !== from
    }, from, { timeout })
    .then(() => true, () => false)
async function fullscreenOn(page) {
  await page.locator("movi-player").hover()
  try {
    await page.locator("movi-player .movi-fullscreen-btn").click({ force: true, timeout: 5000 })
  } catch {
    await page.evaluate(() => document.querySelector("movi-player")?.focus())
    await page.keyboard.press("f")
  }
  return page.waitForFunction(() => !!document.fullscreenElement && document.fullscreenElement === document.querySelector("movi-player"), undefined, { timeout: 10000 }).then(() => true, () => false)
}
const leaveFullscreen = async (page) => {
  await page.evaluate(() => document.fullscreenElement && document.exitFullscreen())
  await page.waitForFunction(() => !document.fullscreenElement).catch(() => {})
}
/** The download one action starts: its file name, and whether a tab opened for it. */
const downloadOf = async (page, act) => {
  const before = page.context().pages().length
  try {
    const [d] = await Promise.all([page.waitForEvent("download", { timeout: 15000 }), act()])
    return { name: d.suggestedFilename(), newTab: page.context().pages().length !== before }
  } catch (e) {
    return { error: String(e?.message || e).split("\n")[0], newTab: page.context().pages().length !== before }
  }
}
const anims = (page) => page.evaluate(() => window.__viewer?.anims ?? [])
/** The run of the docked player's height between two times: from its last resting height to where it settled. */
const dockRun = (heights, from, to) => {
  // heights holds changes only: the one before the window is where it rested
  const before = heights.filter((h) => h[0] < from).pop()
  const span = heights.filter((h) => h[0] >= from && h[0] <= to)
  if (span.length < 3) return null
  const end = span[span.length - 1]
  // the first change shows a frame after the run began
  return { ran: end[0] - span[0][0] + 16, from: before ? before[1] : null, to: end[1], frames: span.length }
}
/** Clicks a row of the list by the file's name (the row itself, not its thumbnail). */
const openRow = async (page, name) => {
  const r = item(page, name)
  await r.scrollIntoViewIfNeeded()
  const box = await r.boundingBox()
  if (!box) throw new Error(`no row ${name}`)
  // the right part of the name column: away from the thumbnail and the checkbox
  await page.mouse.click(box.x + box.width * 0.45, box.y + box.height / 2)
}

/** The folder in the list layout (its layout is kept per folder in layoutRecord). */
const listLayout = () => localStorage.setItem("layoutRecord", JSON.stringify({ "/审计/查看器": "list" }))
// the list layout: one row per file, so the folder is long enough to scroll
await spec("viewer-dock", { chrome: true, init: [viewerProbe, listLayout], video: true }, async (env) => {
  const { page } = env
  const c = checker(env)
  await go(page, VDIR, 1200)
  // scrolled a little: Back must bring the list back to this position
  await scrollY(page, 100)
  const y0 = await page.evaluate(() => window.scrollY)
  const h0 = await histLen(page)
  const t0 = await page.evaluate(() => performance.now())
  await openRow(page, V3)
  c("a video opens the docked player", await seen(page, DOCK_OPEN))
  c("opening pushes /<dir>/<file>", pathOf(page) === `${VDIR}/${V3}` && (await histLen(page)) === h0 + 1, `${pathOf(page)} history ${h0}→${await histLen(page)}`)
  c("the folder stays listed below the player", (await page.locator(".viselect-item").count()) > 10)
  c("the video plays", await playing(page))
  let m = await movi(page)
  c("one movi-player made", m.added === 1 && m.count === 1, m)
  c("the playing row is marked", (await playingMark(page, V3)) === 1)
  await settle(page)
  const t1 = await page.evaluate(() => performance.now())
  const opened = dockRun(await page.evaluate(() => window.__viewer.heights), t0, t1)
  await scrollY(page, 1200)
  c("scrolled away: the dock shrinks to the mini window", await seen(page, DOCK_MINI))
  m = await movi(page)
  c("shrinking does not remount the player", m.added === 1 && m.removed === 0 && m.count === 1, m)
  c("fullscreen from the mini window", await fullscreenOn(page))
  await leaveFullscreen(page)
  await scrollY(page, 0)
  await settle(page)
  c("scrolled back: the dock grows back", await seen(page, `${DOCK}[data-mini="false"]`))
  const h1 = await histLen(page)
  const src1 = (await movi(page)).src
  await page.locator('[data-testid="dock-prev"]').click()
  const switched = await srcChanged(page, src1)
  m = await movi(page)
  c("previous switches the source on the same element", switched && m.added === 1 && m.removed === 0, m)
  c("previous replaces the address", pathOf(page) === `${VDIR}/${V2}` && (await histLen(page)) === h1, pathOf(page))
  c("the mark follows", (await playingMark(page, V2)) === 1 && (await playingMark(page, V3)) === 0)
  await openRow(page, V1)
  const toV1 = await page.waitForFunction(() => decodeURI(location.pathname).endsWith("01 示例视频.mp4"), undefined, { timeout: 5000 }).then(() => true, () => false)
  c("a click on another video switches, replacing the address", toV1 && (await histLen(page)) === h1)
  await page.locator("body").press("Shift+N")
  c("Shift+N goes to the next video", await page.waitForFunction(() => decodeURI(location.pathname).endsWith("02 示例视频.mp4"), undefined, { timeout: 5000 }).then(() => true, () => false))
  c("fullscreen from the dock", await fullscreenOn(page))
  const srcFs = (await movi(page)).src
  await page.evaluate(() => document.querySelector("movi-player")?.focus())
  await page.keyboard.press("Shift+N")
  const fsSwitched = await srcChanged(page, srcFs)
  m = await movi(page)
  c("Shift+N in fullscreen switches the video and stays fullscreen", fsSwitched && m.fullscreen && m.added === 1, m)
  await leaveFullscreen(page)
  const t2 = await page.evaluate(() => {
    // what moves the scroll from here on, for the report
    const log = (window.__scrolls = [])
    const to = window.scrollTo.bind(window)
    window.scrollTo = (...a) => {
      log.push(["to", JSON.stringify(a), Math.round(performance.now())])
      return to(...a)
    }
    addEventListener("scroll", () => log.push(["at", window.scrollY, Math.round(performance.now())]), { passive: true })
    addEventListener("popstate", () => log.push(["pop", JSON.stringify(history.state)]), true)
    log.push(["before", JSON.stringify(history.state), window.scrollY])
    return performance.now()
  })
  await page.goBack()
  c("one Back closes the player", await closedDock(page))
  await settle(page)
  const y = await page.evaluate(() => window.scrollY)
  const moves = await page.evaluate(() => window.__scrolls.slice(0, 40))
  c("Back returns to the folder's address at the scroll it had", pathOf(page) === VDIR && y0 > 50 && Math.abs(y - y0) < 4, `${pathOf(page)} scrollY=${y}, was ${y0}; ${JSON.stringify(moves)}`)
  m = await movi(page)
  c("closing keeps the same player element", m.added === 1 && m.removed === 0 && m.count === 1, m)
  const heights = await page.evaluate(() => window.__viewer.heights)
  const closed = dockRun(heights, t2, Infinity)
  env.report = { ...(env.report ?? {}), dockOpen: opened, dockClose: closed }
  // the height runs on Motion's JS clock: measured by frame, within two frames
  c("the dock opens in 500ms", opened && opened.from === 0 && Math.abs(opened.ran - 500) <= 50, opened)
  c("the dock closes in 200ms", closed && closed.to === 0 && Math.abs(closed.ran - 200) <= 50, closed)
  c.done()
})

// desktop: at most about 60% of the screen high, 16:9, and five rows of the list in sight under it
for (const height of [900, 720]) {
  await spec("viewer-dock-geometry", { height, init: [viewerProbe, listLayout] }, async (env) => {
    const { page } = env
    const c = checker(env)
    await go(page, VDIR, 1200)
    await openRow(page, V1)
    c("the dock opens", await seen(page, DOCK_OPEN))
    await settle(page)
    const g = await page.evaluate(() => {
      const f = document.querySelector('[data-testid="dock-frame"]')?.getBoundingClientRect()
      if (!f) return null
      const rows = [...document.querySelectorAll(".viselect-item")].map((r) => r.getBoundingClientRect()).filter((r) => r.height > 0 && r.top >= f.bottom && r.bottom <= innerHeight)
      return { w: Math.round(f.width), h: Math.round(f.height), vh: innerHeight, rows: rows.length }
    })
    c("the player is at most 60% of the window high", g && g.h <= Math.ceil(g.vh * 0.6) + 1, g)
    c("the player is 16:9", g && Math.abs(g.w / g.h - 16 / 9) < 0.02, g)
    c("five rows of the list show under it", g && g.rows >= 5, g)
    c.done()
  })
}

// a video deep in the list opens where the list is, as the mini window; the
// window floats top right and can be dragged; "back to the player" grows it
const reverseByName = () => localStorage.setItem("dir_sort_/审计/查看器", JSON.stringify({ orderBy: "name", reverse: true }))
await spec("viewer-dock-deep", { chrome: true, init: [viewerProbe, reverseByName], video: true }, async (env) => {
  const { page } = env
  const c = checker(env)
  await go(page, VDIR, 1200)
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  await page.waitForTimeout(300)
  const top0 = (await item(page, V2).boundingBox())?.y
  const h0 = await histLen(page)
  await openRow(page, V2)
  c("a click deep in the list opens the mini window", await seen(page, DOCK_MINI))
  c("and pushes the file's address", pathOf(page) === `${VDIR}/${V2}` && (await histLen(page)) === h0 + 1, pathOf(page))
  await settle(page)
  const top1 = (await item(page, V2).boundingBox())?.y
  c("the list stays where it was", top0 !== undefined && top1 !== undefined && Math.abs(top1 - top0) < 4, { top0, top1 })
  const box = await page.locator('[data-testid="dock-frame"]').boundingBox()
  const vw = await page.evaluate(() => innerWidth)
  c("the mini window floats in the top right corner", box && box.x + box.width > vw - 80 && box.y < 200 && box.width <= 420, box)
  const bar = await page.locator('[data-testid="mini-bar"] [data-drag]').boundingBox()
  if (bar && box) {
    await page.mouse.move(bar.x + 10, bar.y + bar.height / 2)
    await page.mouse.down()
    await page.mouse.move(bar.x - 290, bar.y + 210, { steps: 8 })
    await page.mouse.up()
  }
  const moved = await page.locator('[data-testid="dock-frame"]').boundingBox()
  c("the mini window can be dragged", box && moved && Math.abs(moved.x - (box.x - 300)) < 20 && Math.abs(moved.y - (box.y + 210)) < 20, { box, moved })
  await page.locator('[data-testid="mini-expand"]').click()
  await settle(page)
  c("back to the player grows it at the top", (await seen(page, `${DOCK}[data-mini="false"]`)) && (await page.evaluate(() => window.scrollY)) < 200)
  const m = await movi(page)
  c("the same player throughout", m.added === 1 && m.removed === 0, m)
  c.done()
})

// phone: the mini window is a 72px bar under the top bar
await spec("viewer-dock-phone", { ...PHONE, touch: true, init: viewerProbe, video: true }, async (env) => {
  const { page } = env
  const c = checker(env)
  await go(page, VDIR, 1200)
  await openRow(page, V1)
  c("the dock opens", await seen(page, DOCK_OPEN))
  await settle(page)
  await scrollY(page, 1400)
  c("scrolled away: the mini bar", await seen(page, DOCK_MINI))
  await settle(page)
  const g = await page.evaluate(() => {
    const f = document.querySelector('[data-testid="dock-frame"]')?.getBoundingClientRect()
    // --shell-top is in rem: a fixed probe at that top gives it in pixels
    const probe = document.createElement("div")
    probe.style.cssText = "position:fixed;left:0;width:0;height:0;visibility:hidden"
    probe.style.top = getComputedStyle(document.querySelector("[data-shell-frame]")).getPropertyValue("--shell-top").trim() || "0px"
    document.body.append(probe)
    const top = probe.getBoundingClientRect().top
    probe.remove()
    return f ? { top: Math.round(f.top), h: Math.round(f.height), w: Math.round(f.width), vw: innerWidth, shellTop: top } : null
  })
  c("72px high, full width, under the top bar", g && g.h === 72 && g.w >= g.vw - 1 && Math.abs(g.top - g.shellTop) <= 2, g)
  c.done()
})

// images: a FLIP out of the row, 320ms open / 240ms close on the emphasized
// curves, a 95% black scrim; → switches and replaces the address; closing is Back
await spec("viewer-image", { init: viewerProbe, video: true }, async (env) => {
  const { page } = env
  const c = checker(env)
  await go(page, VDIR, 1200)
  const h0 = await histLen(page)
  await openRow(page, IMG1)
  c("an image opens the image viewer", await seen(page, '[data-testid="viewer-image"]'))
  c("opening pushes the image's address", pathOf(page) === `${VDIR}/${IMG1}` && (await histLen(page)) === h0 + 1, pathOf(page))
  await settle(page)
  const scrim = await page.locator('[data-motion="viewer-scrim"]').evaluate((e) => getComputedStyle(e).backgroundColor).catch(() => null)
  c("the scrim is 95% black", scrim === "rgba(0, 0, 0, 0.95)", scrim)
  await page.keyboard.press("ArrowRight")
  c("→ shows the next image", await page.waitForFunction(() => document.querySelector('[data-testid="image-index"]')?.textContent?.trim().startsWith("2 /"), undefined, { timeout: 5000 }).then(() => true, () => false))
  c("→ replaces the address", pathOf(page) === `${VDIR}/${IMG2}` && (await histLen(page)) === h0 + 1, pathOf(page))
  await settle(page)
  const d = await downloadOf(page, () => page.locator('[data-testid="viewer-download"]').click())
  c("the viewer's download saves the image in this tab", d.name === IMG2 && !d.newTab, d)
  await page.keyboard.press("Escape")
  c("the first Escape closes it", await gone(page, '[data-testid="image-viewer"]'))
  c("closing goes back to the folder's address (Back, not a new entry)", pathOf(page) === VDIR && (await page.evaluate(() => !history.state?.opened)), pathOf(page))
  const a = (await anims(page)).filter((x) => x.motion === "viewer-image" && x.props.includes("transform"))
  env.report = { ...(env.report ?? {}), image: a }
  const open = a.find((x) => Math.abs(x.duration - 320) <= 2)
  const close = a.find((x) => Math.abs(x.duration - 240) <= 2)
  c("it opens out of its row: a transform for 320ms, emphasized-decelerate", open && open.easing === DECEL, a)
  c("and closes into it: 240ms, emphasized-accelerate", close && close.easing === ACCEL, a)
  c.done()
})
await spec("viewer-image-swipe", { ...PHONE, touch: true, init: viewerProbe }, async (env) => {
  const { page } = env
  const c = checker(env)
  await go(page, VDIR, 1200)
  await openRow(page, IMG1)
  c("the image viewer opens", await seen(page, '[data-testid="viewer-image"]'))
  await settle(page)
  await page.evaluate(() => {
    const st = document.querySelector('[data-testid="image-stage"]')
    const r = st.getBoundingClientRect()
    const y = r.top + r.height / 2
    const ev = (type, x) => st.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 7, pointerType: "touch", clientX: x, clientY: y, isPrimary: true }))
    ev("pointerdown", r.right - 40)
    for (let x = r.right - 60; x > r.left + 60; x -= 40) ev("pointermove", x)
    ev("pointerup", r.left + 60)
  })
  c("a swipe goes to the next image", await page.waitForFunction(() => document.querySelector('[data-testid="image-index"]')?.textContent?.trim().startsWith("2 /"), undefined, { timeout: 5000 }).then(() => true, () => false))
  c.done()
})

// text and PDF: a window that opens out of the row (clip-path, 320ms); the
// window has the focus, so the first Escape closes it
await spec("viewer-doc", { init: viewerProbe, video: true }, async (env) => {
  const { page } = env
  const c = checker(env)
  await go(page, VDIR, 1200)
  await openRow(page, TEXT)
  c("text opens in the document viewer", await seen(page, '[data-testid="doc-viewer"]'))
  c("with the text in it", await page.getByText("第 1 行").first().waitFor({ timeout: 10000 }).then(() => true, () => false))
  c("at the file's address", pathOf(page) === `${VDIR}/${TEXT}`, pathOf(page))
  await settle(page)
  await page.keyboard.press("Escape")
  c("the first Escape closes it", await gone(page, '[data-testid="doc-viewer"]'))
  c("back at the folder's address", pathOf(page) === VDIR, pathOf(page))
  const a = (await anims(page)).filter((x) => x.motion === "doc-panel" && x.props.includes("clipPath"))
  env.report = { ...(env.report ?? {}), doc: a }
  c("it opens out of its row: clip-path for 320ms, emphasized-decelerate", a.some((x) => Math.abs(x.duration - 320) <= 2 && x.easing === DECEL), a)
  c("and closes into it: 240ms, emphasized-accelerate", a.some((x) => Math.abs(x.duration - 240) <= 2 && x.easing === ACCEL), a)
  await openRow(page, PDF)
  c("a PDF opens in the document viewer", await seen(page, '[data-testid="doc-viewer"]'))
  c("and shows the document", await page.locator('[data-testid="doc-viewer"]').locator("img, canvas, iframe, embed, object").first().waitFor({ timeout: 15000 }).then(() => true, () => false))
  c.done()
})

// a type nothing shows: a small dialog with download, external players and the link
await spec("viewer-unknown", { init: viewerProbe }, async (env) => {
  const { page } = env
  const c = checker(env)
  await go(page, VDIR, 1200)
  await openRow(page, UNKNOWN)
  c("a file nothing previews opens the small dialog", await seen(page, '[data-testid="unknown-dialog"]'))
  c("no download page", (await page.locator(".fileinfo").count()) === 0)
  const d = await downloadOf(page, () => page.locator('[data-testid="unknown-download"]').click())
  c("its download saves the file in this tab", d.name === UNKNOWN && !d.newTab, d)
  c("it offers external players and the link", (await page.locator('[data-testid="unknown-dialog"] [data-action="players"]').count()) === 1 && (await page.locator('[data-testid="unknown-dialog"] [data-action="copy_link"]').count()) === 1)
  await page.keyboard.press("Escape")
  c("the first Escape closes it", await gone(page, '[data-testid="unknown-dialog"]'))
  c.done()
})

// refresh and links to a file: the folder first, then the file over it; closing
// a file that was linked to replaces its address with the folder's
await spec("viewer-deep-link", { chrome: true, init: viewerProbe }, async (env) => {
  const { page } = env
  const c = checker(env)
  await page.goto(OL + encodeURI(`${VDIR}/${V2}`), { waitUntil: "domcontentloaded" })
  const opened = await seen(page, DOCK_OPEN, 15000)
  c("a link to a video opens the dock over its folder", opened && (await page.locator(".viselect-item").count()) > 10)
  c("on that video", ((await page.locator('[data-testid="dock-title"]').textContent().catch(() => "")) ?? "").trim() === V2)
  await page.reload({ waitUntil: "domcontentloaded" })
  c("refresh opens it again", (await seen(page, DOCK_OPEN, 15000)) && ((await page.locator('[data-testid="dock-title"]').textContent().catch(() => "")) ?? "").trim() === V2)
  const h = await histLen(page)
  await page.locator('[data-testid="dock-close"]').click()
  c("closing it replaces the address with the folder's", (await closedDock(page)) && pathOf(page) === VDIR && (await histLen(page)) === h, `${pathOf(page)} history ${h}→${await histLen(page)}`)
  await page.goto(OL + encodeURI(`${VDIR}/${IMG1}`), { waitUntil: "domcontentloaded" })
  c("a link to an image opens the image viewer over its folder", (await seen(page, '[data-testid="viewer-image"]', 15000)) && (await page.locator(".viselect-item").count()) > 10)
  c.done()
})

// downloads from the list: the row's button, the right-click menu and the
// selection bar save one file in this tab; two files go as one package
await spec("viewer-downloads", { init: viewerProbe }, async (env) => {
  const { page } = env
  const c = checker(env)
  await go(page, VDIR, 1200)
  await item(page, TEXT).hover()
  let d = await downloadOf(page, () => item(page, TEXT).locator('[data-testid="row-download"]').click({ timeout: 3000 }))
  c("the row's download button", d.name === TEXT && !d.newTab, d)
  await item(page, TEXT).click({ button: "right" })
  d = await downloadOf(page, () => page.locator('[role="menu"] [data-action="download"]').first().click({ timeout: 3000 }))
  c("the right-click menu", d.name === TEXT && !d.newTab, d)
  await page.keyboard.press("Escape")
  // the right-click selected the text file: the selection bar starts from nothing
  await page.locator('[data-action="cancel_select"]').click({ timeout: 2000 }).catch(() => {})
  await selectRows(page, PDF, false)
  d = await downloadOf(page, () => page.locator('[data-selection-bar] [data-action="download"]').click({ timeout: 3000 }))
  c("the selection bar, one file", d.name === PDF && !d.newTab, d)
  await selectRows(page, TEXT, false)
  await page.locator('[data-selection-bar] [data-action="download"]').click({ timeout: 3000 }).catch(() => {})
  // the package dialog opens on its streamsaver note; Confirm starts the package
  c("two files go as one package", await page.getByText(tr("home.toolbar.pre_package_download-tips")).first().waitFor({ timeout: 5000 }).then(() => true, () => false))
  await page.getByRole("button", { name: tr("global.cancel") }).last().click({ timeout: 2000 }).catch(() => {})
  // Known gap (§0.3-1, awaiting the user): a storage whose /d answers with a
  // 302 to another origin (115 and the like) cannot be saved under its name
  // from the page; a[download] is ignored across origins, so the browser opens
  // the file in a new tab as before. CI has no such storage.
  env.report = { ...(env.report ?? {}), knownGap: "cross-origin 302 downloads keep the CDN's name and open a tab (plan §0.3-1, backend change not approved)" }
  c.done()
})

// a sidecar subtitle comes with its video and goes with it
await spec("viewer-subtitles", { chrome: true, init: viewerProbe }, async (env) => {
  const { page } = env
  const c = checker(env)
  await go(page, VDIR, 1200)
  await openRow(page, V1)
  c("the dock opens", await seen(page, DOCK_OPEN))
  const withSub = await page.waitForFunction(() => (document.querySelector("movi-player")?.querySelectorAll("track").length ?? 0) > 0, undefined, { timeout: 20000 }).then(() => true, () => false)
  c("the first video's subtitle is declared", withSub, await movi(page))
  const src = (await movi(page)).src
  await page.locator('[data-testid="dock-next"]').click()
  await srcChanged(page, src)
  await page.waitForTimeout(1500)
  let m = await movi(page)
  c("switching to the second video takes the old subtitle away", m.tracks === 0 && m.added === 1, m)
  await page.locator('[data-testid="dock-prev"]').click()
  const back = await page.waitForFunction(() => (document.querySelector("movi-player")?.querySelectorAll("track").length ?? 0) === 1, undefined, { timeout: 20000 }).then(() => true, () => false)
  m = await movi(page)
  c("and back on the first it is there once", back && m.added === 1, m)
  c.done()
})

// episodes only in a media library's work
await spec("viewer-episode-bar", { init: viewerProbe }, async (env) => {
  const { page } = env
  const c = checker(env)
  await go(page, SEASON, 1500)
  await openRow(page, "剧集乙 S01E01.mp4")
  c("the dock opens", await seen(page, DOCK_OPEN))
  c("a work of a media library has the episode bar", await seen(page, '[data-testid="episode-bar"]', 8000))
  await go(page, VDIR, 1200)
  await openRow(page, V1)
  await seen(page, DOCK_OPEN)
  await page.waitForTimeout(1500)
  c("a plain folder does not", (await page.locator('[data-testid="episode-bar"]').count()) === 0)
  c.done()
})

// the viewer's More menu carries what the download page and the player page had
await spec("viewer-more-menu", { init: viewerProbe }, async (env) => {
  const { page } = env
  const c = checker(env)
  await go(page, VDIR, 1200)
  await openRow(page, V1)
  await seen(page, DOCK_OPEN)
  await page.locator('[data-testid="dock-more"]').click()
  const menu = page.locator('[role="menu"]').first()
  await menu.waitFor({ timeout: 3000 }).catch(() => {})
  const actions = await menu.locator("[data-action]").evaluateAll((els) => els.map((e) => e.getAttribute("data-action")))
  for (const a of ["copy_link", "qr_code", "open_with", "players", "mpv_command", "info", "share"]) c(`the player's More has ${a}`, actions.includes(a), actions)
  await page.keyboard.press("Escape")
  await page.locator('[data-testid="dock-close"]').click()
  await closedDock(page)
  await openRow(page, TEXT)
  await seen(page, '[data-testid="doc-viewer"]')
  await page.locator('[data-testid="viewer-more"]').click()
  await page.locator('[role="menu"]').first().waitFor({ timeout: 3000 }).catch(() => {})
  const docActions = await page.locator('[role="menu"]').first().locator("[data-action]").evaluateAll((els) => els.map((e) => e.getAttribute("data-action")))
  for (const a of ["copy_link", "qr_code", "open_with", "info"]) c(`the document viewer's More has ${a}`, docActions.includes(a), docActions)
  c.done()
})

// a share of one file opens that file in the viewer
await spec("viewer-single-file-share", { init: viewerProbe }, async (env) => {
  const { page } = env
  const c = checker(env)
  const created = await fetch(OL + "/api/share/create", {
    method: "POST",
    headers: { Authorization: token, "Content-Type": "application/json" },
    body: JSON.stringify({ files: [`${VDIR}/${TEXT}`], pwd: "", expires: null, max_accessed: 0, burn_after_read: false, order_by: "", order_direction: "", extract_folder: "", remark: "single file", readme: "", header: "" }),
  }).then((r) => r.json())
  const id = created?.data?.id
  if (!id) throw new Error(`could not create a share: ${JSON.stringify(created)}`)
  // shares preview only when the site lets them (share_preview, off by
  // default): on for this spec, then back as it was
  const setting = async (key, value) => {
    const got = await fetch(OL + `/api/admin/setting/get?key=${key}`, { headers: { Authorization: token } }).then((r) => r.json())
    const before = got?.data?.value
    await fetch(OL + "/api/admin/setting/save", { method: "POST", headers: { Authorization: token, "Content-Type": "application/json" }, body: JSON.stringify([{ ...got.data, value }]) })
    return before
  }
  const was = await setting("share_preview", "true")
  try {
    // shares download first by default (share_preview_download_by_default):
    // the small dialog, with the previews under Open with
    await page.goto(OL + `/@s/${id}`, { waitUntil: "domcontentloaded" })
    c("previews on: the small dialog first", await seen(page, '[data-testid="unknown-dialog"]', 15000))
    await page.locator('[data-testid="unknown-dialog"] [data-action="players"]').click({ timeout: 3000 })
    await page.locator('[data-action="open_with"]').first().click({ timeout: 3000 })
    c("Open with shows it in the document viewer", await seen(page, '[data-testid="doc-viewer"]', 15000))
    c("with its text", await page.getByText("第 1 行").first().waitFor({ timeout: 10000 }).then(() => true, () => false))
    const d = await downloadOf(page, () => page.locator('[data-testid="viewer-download"]').click())
    c("and downloads under its name", d.name === TEXT && !d.newTab, d)
  } finally {
    await setting("share_preview", was ?? "false")
  }
  // with previews off, the same share offers the file in the small dialog
  await page.goto(OL + `/@s/${id}`, { waitUntil: "domcontentloaded" })
  c("previews off: the small dialog", await seen(page, '[data-testid="unknown-dialog"]', 15000))
  await page.locator('[data-testid="unknown-dialog"] [data-action="players"]').click({ timeout: 3000 }).catch(() => {})
  c("with nothing under Open with", (await seen(page, '[role="menu"]', 3000)) && (await page.locator('[data-action="open_with"]').count()) === 0)
  await page.keyboard.press("Escape")
  const d2 = await downloadOf(page, () => page.locator('[data-testid="unknown-download"]').click())
  c("which downloads under its name", d2.name === TEXT && !d2.newTab, d2)
  c.done()
})

// reduced motion: every viewer animation is a fade of at most 100ms
await spec("viewer-reduced", { reducedMotion: "reduce", init: viewerProbe }, async (env) => {
  const { page } = env
  const c = checker(env)
  await go(page, VDIR, 1200)
  for (const [name, sel] of [[IMG1, '[data-testid="image-viewer"]'], [TEXT, '[data-testid="doc-viewer"]']]) {
    await openRow(page, name)
    c(`${name} opens`, await seen(page, sel))
    await settle(page)
    await page.keyboard.press("Escape")
    c(`${name} closes`, await gone(page, sel))
    await settle(page)
  }
  await openRow(page, V1)
  c("the dock opens", await seen(page, DOCK_OPEN))
  await settle(page)
  await page.locator('[data-testid="dock-close"]').click()
  await closedDock(page)
  await settle(page)
  const ours = (await anims(page)).filter((a) => a.iterations !== Infinity && /^(viewer-|doc-|dock|unknown|dialog|scrim)/.test(a.motion))
  const heights = await page.evaluate(() => window.__viewer.heights)
  env.report = { ...(env.report ?? {}), anims: ours, heights }
  c("viewer animations ran", ours.length > 0, ours)
  const long = ours.filter((a) => a.duration > 100)
  c("none longer than 100ms", long.length === 0, long)
  const moving = ours.filter((a) => a.props.some((p) => p !== "opacity"))
  c("none moves or clips", moving.length === 0, moving)
  // the dock's height jumps: no frame between closed and open
  const full = Math.max(0, ...heights.map((h) => h[1]))
  const between = heights.filter((h) => h[1] > 0 && h[1] < full)
  c("the dock's height does not run", between.length === 0, heights)
  c.done()
})

// ---- P4: motion across the app (docs/PLAN_FE_SYSTEM_UX_1127.md §P4; the
// durations and curves of research 02 §三). Each spec reads what the browser
// ran (viewerProbe: every animation with the data-motion of what it moves) or,
// for what Motion runs on its own clock (heights), the box frame by frame.
const P4DIR = `${MOUNT}/动效`
const near = (a, ms, tol = 2) => typeof a === "number" && Math.abs(a - ms) <= tol
// what the marked layer itself ran; the controls inside a layer (rows under
// files-live) keep their own hover transitions
const named = (list, motion, prop) => list.filter((a) => a.own && a.motion === motion && (!prop || a.props.includes(prop)))
const freshAnims = (page) => page.evaluate(() => (window.__viewer.anims = []).length)
const putFile = (p, text) =>
  fetch(OL + "/api/fs/put", { method: "PUT", headers: { Authorization: token, "File-Path": encodeURIComponent(p), "Content-Type": "application/octet-stream" }, body: text }).then((r) => r.json())
const listNames = async (dir) => ((await olPost("/api/fs/list", { path: dir, refresh: true }, token))?.content ?? []).map((o) => o.name)
const removeAll = (dir, names) => olPost("/api/fs/remove", { dir, names }, token).catch(() => {})
const layoutOf = (dir, kind) => new Function(`localStorage.setItem("layoutRecord", JSON.stringify({ ${JSON.stringify(dir)}: ${JSON.stringify(kind)} }))`)
const inPath = (page, end) => page.waitForFunction((end) => decodeURI(location.pathname).replace(/\/$/, "").endsWith(end), end, { timeout: 8000 }).then(() => true, () => false)

// entering a folder: the old content fades out in 90ms, the new one fades in
// in 150ms after it (MD fade through), nothing moves; Back does the same
await spec("p4-folder-fade", { init: viewerProbe, video: true }, async (env) => {
  const { page } = env
  const c = checker(env)
  await go(page, MOUNT, 1200)
  await freshAnims(page)
  await openRow(page, "文档")
  c("a folder opens", await inPath(page, "/文档"))
  await settle(page)
  let a = await anims(page)
  const out = named(a, "files-ghost", "opacity")[0]
  const inn = named(a, "files-live", "opacity")[0]
  c("the folder left fades out in 90ms", out && near(out.duration, 90) && out.easing === ACCEL, out ?? a)
  c("the folder entered fades in in 150ms, once the other is gone", inn && near(inn.duration, 150) && near(inn.delay, 90) && inn.easing === DECEL, inn ?? a)
  c("neither moves", [...named(a, "files-ghost"), ...named(a, "files-live")].every((x) => x.props.every((p) => p === "opacity")), a)
  c("the picture of the folder left is taken away", await page.evaluate(() => !document.querySelector("[data-files-ghost]")?.children.length))
  await freshAnims(page)
  await page.goBack()
  c("Back returns", await inPath(page, MOUNT))
  await settle(page)
  a = await anims(page)
  c("Back fades through too", named(a, "files-ghost", "opacity").length > 0 && named(a, "files-live", "opacity").length > 0, a)
  c.done()
})

// grid <-> list: the two cross-fade in 150ms
await spec("p4-layout-crossfade", { init: viewerProbe }, async (env) => {
  const { page } = env
  const c = checker(env)
  await go(page, `${MOUNT}/文档`, 1200)
  await freshAnims(page)
  await page.locator("[data-files-view]").click()
  await page.getByRole("menuitem", { name: tr("home.layouts.list") }).click()
  c("the list shows", await seen(page, ".list"))
  await settle(page)
  const a = await anims(page)
  const out = named(a, "files-ghost", "opacity")[0]
  const inn = named(a, "files-live", "opacity")[0]
  c("the grid fades out in 150ms", out && near(out.duration, 150), out ?? a)
  c("the list fades in in 150ms at the same time", inn && near(inn.duration, 150) && near(inn.delay, 0), inn ?? a)
  c.done()
})

// the selection's bar: slides and fades in (200ms), out (150ms); leaving, it
// is out of the flow at once, so the search box takes its place without a jump
await spec("p4-selection-bar", { init: viewerProbe }, async (env) => {
  const { page } = env
  const c = checker(env)
  await go(page, `${MOUNT}/文档`, 1200)
  await freshAnims(page)
  await selectRows(page, "笔记.txt", false)
  c("the bar shows", await seen(page, "[data-selection-bar]"))
  await settle(page)
  let a = named(await anims(page), "selection-bar")
  const enter = a.find((x) => x.props.includes("opacity"))
  const slide = a.find((x) => x.props.includes("transform"))
  c("it comes in in 200ms, fading", enter && near(enter.duration, 200) && enter.easing === DECEL, a)
  c("and sliding", slide && near(slide.duration, 200), a)
  await freshAnims(page)
  const position = await page.evaluate(() => {
    document.querySelector('[data-action="cancel_select"]').click()
    const bar = document.querySelector('[data-motion="selection-bar"]')
    return bar ? getComputedStyle(bar).position : "gone"
  })
  c("leaving, it is out of the flow at once", position === "absolute", position)
  await settle(page)
  a = named(await anims(page), "selection-bar", "opacity")
  c("it leaves in 150ms", a[0] && near(a[0].duration, 150) && a[0].easing === ACCEL, a)
  c("and is gone after", await gone(page, "[data-selection-bar]"))
  c.done()
})

// rows that come, go and move: a new row fades in (200ms) and is lit for
// 1200ms; a removed one fades out (150ms) where it was; the others slide to
// their new places (250ms, standard), also when the order changes
await spec("p4-list-changes", { init: [viewerProbe, layoutOf(P4DIR, "list")], video: true }, async (env) => {
  const { page } = env
  const c = checker(env)
  await olPost("/api/fs/mkdir", { path: P4DIR }, token).catch(() => {})
  for (const n of ["b.txt", "c.txt", "d.txt", "e.txt"]) await putFile(`${P4DIR}/${n}`, n)
  try {
    await go(page, P4DIR, 1200)
    await freshAnims(page)
    await putFile(`${P4DIR}/a.txt`, "a")
    await page.locator('[data-action="refresh"]').first().click()
    c("the new row shows", await seen(page, '[data-row-name="a.txt"]'))
    await settle(page)
    let a = await anims(page)
    const come = named(a, "row", "opacity")[0]
    const lit = named(a, "row", "backgroundColor")[0]
    c("a new row fades in in 200ms", come && near(come.duration, 200) && come.easing === DECEL, a)
    c("and is lit for 1200ms", lit && near(lit.duration, 1200), a)
    await freshAnims(page)
    await removeAll(P4DIR, ["c.txt"])
    await page.locator('[data-action="refresh"]').first().click()
    c("the removed row goes", await gone(page, '[data-row-name="c.txt"]'))
    await settle(page)
    a = await anims(page)
    const leave = named(a, "row-ghost", "opacity")[0]
    const slide = named(a, "row", "transform")[0]
    c("a removed row fades out in 150ms", leave && near(leave.duration, 150) && leave.easing === ACCEL, a)
    c("the rows under it slide up in 250ms", slide && near(slide.duration, 250) && slide.easing === STANDARD, a)
    c("nothing is left of it", await page.evaluate(() => !document.querySelector('[data-motion="row-ghost"]')))
    await freshAnims(page)
    await page.locator("[data-files-sort]").first().click()
    await page.locator('[data-sort-dir="desc"]').click()
    await settle(page)
    a = await anims(page)
    const moved = named(a, "row", "transform")
    c("a new order slides the rows to their places", moved.length >= 2 && moved.every((x) => near(x.duration, 250) && x.easing === STANDARD), a)
  } finally {
    await removeAll(MOUNT, ["动效"])
  }
  c.done()
})

// the side nav's folder tree: a folder's children open (220ms) and fold
// (180ms) by height; its caret turns on the same clock
const foldRun = (page, label) =>
  page.evaluate(async (label) => {
    const items = [...document.querySelectorAll('[role="treeitem"]')]
    const item = items.find((r) => r.querySelector(":scope > div span:last-child")?.textContent?.trim() === label)
    if (!item) return { error: `no tree row ${label}` }
    const t0 = performance.now()
    item.querySelector(':scope > div button[aria-label="toggle"]').click()
    const hs = []
    await new Promise((done) => {
      const f = () => {
        const fold = item.querySelector(':scope > [data-motion="fold"]')
        const h = fold ? Math.round(fold.getBoundingClientRect().height) : -1
        if (!hs.length || hs[hs.length - 1][1] !== h) hs.push([Math.round(performance.now() - t0), h])
        if (performance.now() - t0 < 2500) requestAnimationFrame(f)
        else done()
      }
      requestAnimationFrame(f)
    })
    const caret = item.querySelector(":scope > div button svg")
    return { hs, caret: caret ? getComputedStyle(caret).transitionDuration : "" }
  }, label)
/** From the first frame it changed to the frame it settled. */
const runOf = (hs) => {
  const moving = hs.filter((h) => h[1] > 0)
  if (hs.length < 3) return null
  const end = hs[hs.length - 1]
  const startAt = hs.find((h, i) => i > 0 && h[1] !== hs[0][1])
  return startAt ? { ran: end[0] - startAt[0] + 16, to: end[1], frames: hs.length, max: Math.max(...moving.map((h) => h[1])) } : null
}
await spec("p4-tree", { init: viewerProbe }, async (env) => {
  const { page } = env
  const c = checker(env)
  await go(page, "/", 1500)
  const open = await foldRun(page, "审计")
  const o = runOf(open.hs ?? [])
  c("a folder's children open by height in 220ms", o && o.to > 0 && Math.abs(o.ran - 220) <= 50, open)
  c("its caret turns in 220ms", open.caret === "0.22s", open.caret)
  const shut = await foldRun(page, "审计")
  const s = runOf(shut.hs ?? [])
  c("and fold in 180ms", s && s.to === 0 && Math.abs(s.ran - 180) <= 50, shut)
  c("its caret turns back in 180ms", shut.caret === "0.18s", shut.caret)
  c.done()
})

// one kind of toast, Motion's (200ms in, 150ms out); a rename offers to undo
// it for 5 seconds, undoing is renaming back, and an undo that cannot be done
// says why
const P4UNDO = `${MOUNT}/撤销`
const renameIn = async (page, from, to) => {
  await selectRows(page, from, false)
  await page.locator('[data-selection-bar] [data-action="rename"]').click()
  const input = page.locator('[role="dialog"] input').first()
  await input.fill(to)
  await page.locator('[role="dialog"]').getByRole("button", { name: tr("global.ok") }).click()
}
await spec("p4-toast-undo", { init: [viewerProbe, layoutOf(P4UNDO, "list")], video: true }, async (env) => {
  const { page } = env
  const c = checker(env)
  await olPost("/api/fs/mkdir", { path: P4UNDO }, token).catch(() => {})
  await putFile(`${P4UNDO}/原名.txt`, "x")
  try {
    await go(page, P4UNDO, 1200)
    await freshAnims(page)
    await renameIn(page, "原名.txt", "新名.txt")
    const toast = page.locator('[data-motion="toast"]').filter({ has: page.locator('[data-testid="toast-action"]') }).first()
    c("a rename says so, with Undo", await toast.waitFor({ timeout: 5000 }).then(() => true, () => false))
    await settle(page)
    let a = named(await anims(page), "toast")
    const tin = a.find((x) => x.props.includes("opacity"))
    c("the toast comes in in 200ms", tin && near(tin.duration, 200) && tin.easing === DECEL, a)
    c("hope's notifications are not used", (await page.locator(".hope-notification__root, [class*='hope-notification']").count()) === 0)
    await toast.locator('[data-testid="toast-action"]').click()
    const back = await (async () => {
      for (let i = 0; i < 20; i++) {
        const n = await listNames(P4UNDO)
        if (n.includes("原名.txt") && !n.includes("新名.txt")) return true
        await sleep(250)
      }
      return false
    })()
    c("Undo renames it back", back, await listNames(P4UNDO))
    c("and the list shows the old name", await seen(page, '[data-row-name="原名.txt"]'))
    // an undo that cannot be done: the old name is taken again by then
    await renameIn(page, "原名.txt", "新名.txt")
    await toast.waitFor({ timeout: 5000 }).catch(() => {})
    await putFile(`${P4UNDO}/原名.txt`, "taken")
    await toast.locator('[data-testid="toast-action"]').click()
    const err = page.locator('[data-motion="toast"][data-toast-kind="error"]').first()
    c("a failed undo says why", await err.waitFor({ timeout: 5000 }).then(() => true, () => false))
    const text = await err.innerText().catch(() => "")
    c("in words, with the server's reason", tr("files.undo_failed").test(text) || /undo/i.test(text), text)
    await freshAnims(page)
    await err.locator('[data-testid="toast-close"]').click()
    c("a toast closes on its button", await gone(page, '[data-motion="toast"][data-toast-kind="error"]'))
    // the exit, not an entrance still on the list (the error toast's own)
    a = named(await anims(page), "toast", "opacity").filter((x) => x.easing === ACCEL)
    c("leaving in 150ms", a[0] && near(a[0].duration, 150), a)
  } finally {
    await removeAll(MOUNT, ["撤销"])
  }
  c.done()
})

// a submenu stands still once it is open: on a phone the batch bar's Copy
// link submenu kept moving, too long for a click (45991318607). Its box is
// read every frame for 1.5s after the click; it may move while it comes in,
// and must hold still from 500ms on
await spec("menu-submenu-still-390", { width: 390, height: 844 }, async (env) => {
  const { page } = env
  const c = checker(env)
  await go(page, `${MOUNT}/文档`, 1200)
  await selectRows(page, "笔记.txt", true)
  await page.locator('[data-batch="more"]').click()
  await seen(page, '[data-motion="menu"]')
  const run = page.evaluate(
    () =>
      new Promise((done) => {
        const boxes = []
        const t0 = performance.now()
        const f = () => {
          const menus = document.querySelectorAll('[data-motion="menu"]')
          const sub = menus.length > 1 ? menus[menus.length - 1] : null
          const r = sub?.getBoundingClientRect()
          const b = r ? [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)].join(",") : "none"
          if (!boxes.length || boxes[boxes.length - 1][1] !== b) boxes.push([Math.round(performance.now() - t0), b])
          if (performance.now() - t0 < 1500) requestAnimationFrame(f)
          else done(boxes)
        }
        requestAnimationFrame(f)
      }),
  )
  await page.getByRole("menuitem", { name: tr("home.toolbar.copy_link") }).click()
  const boxes = await run
  const last = boxes[boxes.length - 1]
  c("the submenu opens", last && last[1] !== "none", boxes)
  c("and holds still from 500ms on", last && last[0] <= 500, boxes)
  c("inside the screen", last && last[1] !== "none" && (() => {
    const [x, y, w, h] = last[1].split(",").map(Number)
    return x >= 0 && y >= 0 && x + w <= 390 && y + h <= 844
  })(), last)
  // it opens to the left here (no room on the right); a pointer that lands in
  // it in one move, as a fast hand does, must not close it (Kobalte judged
  // the way by moves inside the parent menu only: FWLJS4DZ.jsx:265, :905-915)
  const item = page.getByRole("menuitem", { name: tr("home.toolbar.down_link") })
  const ib = await item.boundingBox()
  await page.mouse.move(ib.x + ib.width / 2, ib.y + ib.height / 2)
  await sleep(400)
  c("a pointer that jumps into it keeps it open", (await page.locator('[data-motion="menu"]').count()) === 2 && (await item.isVisible()))
  c.done()
})

// the toasts' stack, as sonner (src/index.tsx) and Kobalte's toast keep it:
// the newest in front and three in sight; alt+T takes the focus there; a
// toast is swiped away (right or down), a short drag lets it go back. On the
// desktop and on a phone, through the batch menus of both
for (const phone of [false, true]) await spec("p4-toast-stack", phone ? { width: 390, height: 844 } : {}, async (env) => {
  const { page, ctx } = env
  const c = checker(env)
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: OL })
  await go(page, `${MOUNT}/文档`, 1200)
  // four notices through the UI: a link copied from the batch menu, four times
  await selectRows(page, "笔记.txt", phone)
  // on a phone the submenu comes up where the earlier toasts are: the menu,
  // just opened, is drawn over them and takes the tap (run 46014711932: a
  // toast behind the front one took it and the menu closed)
  const under = []
  for (let i = 0; i < 4; i++) {
    await page.locator(phone ? '[data-batch="more"]' : '[data-selection-bar] [data-action="batch-more"]').click()
    await page.getByRole("menuitem", { name: tr("home.toolbar.copy_link") }).click()
    const item = page.getByRole("menuitem", { name: tr("home.toolbar.down_link") })
    await item.waitFor()
    await settle(page)
    const ib = await item.boundingBox()
    const top = await page.evaluate(([x, y]) => {
      const el = document.elementFromPoint(x, y)
      return el?.closest('[role="menuitem"]') ? "" : (el?.closest("[data-motion]")?.getAttribute("data-motion") ?? el?.tagName ?? "none")
    }, [ib.x + ib.width / 2, ib.y + ib.height / 2])
    if (top) {
      under.push(`${i}:${top}`)
      break
    }
    await item.click()
  }
  c("the open menu is over the toasts", under.length === 0, under)
  if (under.length) return c.done()
  const items = page.locator('[data-motion="toast"]')
  // each copy says so once the clipboard has it: the last may come a moment later
  await page.waitForFunction(() => document.querySelectorAll('[data-motion="toast"]').length >= 4, null, { timeout: 3000 }).catch(() => {})
  // the focus in the toasts holds their timers from here (Kobalte toast-list.tsx)
  await page.keyboard.press("Alt+KeyT")
  c("the notices stack", (await items.count()) >= 4, await items.count())
  const vis = await items.evaluateAll((l) => l.map((t) => t.getAttribute("data-visible")))
  c("three are in sight, the newest in front", vis.slice(0, 3).every((v) => v === "true") && vis.slice(3).every((v) => v === "false"), vis)
  c("alt+T takes the focus to them", await page.evaluate(() => !!document.activeElement?.closest("[data-toast-region]")))
  // the focus stays there: their timers wait (Kobalte toast-list.tsx) while they are dragged
  const front = items.first()
  const box = await front.boundingBox()
  const before = await items.count()
  // a short drag: it goes back
  await page.mouse.move(box.x + 40, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + 60, box.y + box.height / 2, { steps: 4 })
  await sleep(300)
  await page.mouse.up()
  await sleep(500)
  c("a short drag lets it go back", (await items.count()) === before)
  // a swipe to the right: it goes
  await page.mouse.move(box.x + 40, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + 200, box.y + box.height / 2, { steps: 6 })
  await page.mouse.up()
  await sleep(600)
  c("a swipe takes it away", (await items.count()) === before - 1, await items.count())
  c.done()
})

// copying from a button: its icon turns into a check (100ms) for 1.5s
await spec("p4-copy-check", { init: viewerProbe }, async (env) => {
  const { page, ctx } = env
  const c = checker(env)
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: OL })
  await go(page, `${MOUNT}/文档`, 1200)
  await selectRows(page, "笔记.txt", false)
  await page.locator('[data-selection-bar] [data-action="share"]').click()
  await page.locator('[data-testid="share-create"]').click()
  const btn = page.locator('[data-testid="share-dialog"] [data-testid="copy-button"]')
  c("the link has a copy button", await btn.waitFor({ timeout: 5000 }).then(() => true, () => false))
  await freshAnims(page)
  await btn.click()
  c("it shows a check", await seen(page, '[data-testid="share-dialog"] [data-testid="copy-button"][data-copied]', 2000))
  // the check starts on the frame after it is in the page, the probe reads it on the next
  await settle(page)
  const a = named(await anims(page), "copy-icon")
  c("turning in 100ms", a.length > 0 && a.every((x) => near(x.duration, 100)), a)
  await sleep(1700)
  c("and turns back after 1.5s", (await page.locator('[data-testid="share-dialog"] [data-testid="copy-button"][data-copied]').count()) === 0)
  c("the clipboard holds the link", /\/@s\//.test(await page.evaluate(() => navigator.clipboard.readText()).catch(() => "")))
  c.done()
})

// an upload's progress: the bar runs to each new value (200ms) and a check
// shows once it is done
await spec("p4-progress", { init: viewerProbe }, async (env) => {
  const { page } = env
  const c = checker(env)
  await go(page, `${MOUNT}/文档`, 1200)
  await freshAnims(page)
  await page.locator("[data-files-new]").click()
  const [chooser] = await Promise.all([page.waitForEvent("filechooser", { timeout: 8000 }), page.locator('[data-action="upload"]').click()])
  await chooser.setFiles({ name: "进度.bin", mimeType: "application/octet-stream", buffer: Buffer.alloc(3 * 1024 * 1024, 7) })
  try {
    c("the upload is done, with a check", await seen(page, '[data-testid="progress-done"]', 20000))
    const a = named(await anims(page), "progress-fill", "width")
    c("the bar runs to its value in 200ms", a.length > 0 && a.every((x) => near(x.duration, 200) && x.easing === STANDARD), a)
  } finally {
    await removeAll(`${MOUNT}/文档`, ["进度.bin"])
  }
  c.done()
})

// switching the theme: the new colors spread from the button (a view
// transition, 200ms); reduced motion switches at once
const themeButton = (page) => page.getByRole("button", { name: tr("shell.nav.toggle_theme") }).first()
await spec("p4-theme", { init: viewerProbe }, async (env) => {
  const { page } = env
  const c = checker(env)
  await go(page, MOUNT, 1200)
  await freshAnims(page)
  const dark0 = await page.evaluate(() => document.documentElement.classList.contains("dark"))
  await themeButton(page).click()
  await sleep(600)
  const a = (await anims(page)).filter((x) => x.pseudo === "::view-transition-new(root)")
  c("the new theme spreads from the button in 200ms", a.some((x) => x.props.includes("clipPath") && near(x.duration, 200)), await anims(page))
  c("the theme changed", (await page.evaluate(() => document.documentElement.classList.contains("dark"))) !== dark0)
  c.done()
})

// reduced motion: these are fades of at most 100ms, or nothing
await spec("p4-reduced", { reducedMotion: "reduce", init: viewerProbe }, async (env) => {
  const { page } = env
  const c = checker(env)
  await go(page, MOUNT, 1200)
  await freshAnims(page)
  await openRow(page, "文档")
  await inPath(page, "/文档")
  await settle(page)
  await selectRows(page, "笔记.txt", false)
  await settle(page)
  await page.locator('[data-action="cancel_select"]').click()
  await settle(page)
  const dark0 = await page.evaluate(() => document.documentElement.classList.contains("dark"))
  await themeButton(page).click()
  await sleep(400)
  const ours = (await anims(page)).filter((a) => a.own && a.iterations !== Infinity && /^(files-|selection-bar|row|toast|copy-icon|progress|drop-overlay)/.test(a.motion))
  env.report = { ...(env.report ?? {}), anims: ours }
  c("folder and selection animations ran", ours.length > 0, ours)
  c("none longer than 100ms", ours.every((a) => a.duration <= 100), ours)
  c("none moves", ours.every((a) => a.props.every((p) => p === "opacity")), ours)
  c("the theme switches without a transition", (await page.evaluate(() => document.documentElement.classList.contains("dark"))) !== dark0 && !(await anims(page)).some((x) => x.pseudo.startsWith("::view-transition")))
  c.done()
})

// files dragged in from the desktop, in any layout: a layer saying where they
// will go fades in (100ms); dropping them opens the upload with them
await spec("p4-drop", { init: viewerProbe }, async (env) => {
  const { page } = env
  const c = checker(env)
  await go(page, `${MOUNT}/文档`, 1200)
  await freshAnims(page)
  const dt = await page.evaluateHandle(() => {
    const d = new DataTransfer()
    d.items.add(new File(["dropped\n"], "拖入.txt", { type: "text/plain" }))
    return d
  })
  const area = page.locator("[data-files-area]").first()
  await area.dispatchEvent("dragenter", { dataTransfer: dt })
  await area.dispatchEvent("dragover", { dataTransfer: dt })
  const layer = page.locator('[data-testid="drop-overlay"]')
  c("a layer says where the files will go", await layer.waitFor({ timeout: 3000 }).then(() => true, () => false))
  c("naming the folder", /文档/.test(await layer.innerText().catch(() => "")))
  c("the upload does not open before the drop", (await page.locator('[role="dialog"]').count()) === 0)
  await settle(page)
  const a = named(await anims(page), "drop-overlay", "opacity")
  c("it fades in in 100ms", a[0] && near(a[0].duration, 100), a)
  await layer.dispatchEvent("drop", { dataTransfer: dt })
  try {
    c("the drop opens the upload with the file", await page.getByText("拖入.txt").first().waitFor({ timeout: 8000 }).then(() => true, () => false))
    c("the layer goes", await gone(page, '[data-testid="drop-overlay"]'))
    await sleep(2000)
  } finally {
    await removeAll(`${MOUNT}/文档`, ["拖入.txt"])
  }
  c.done()
})

// the CI backend makes video thumbnails (ffmpeg in the image): the folder's
// video card asks for one and gets a picture
await spec("p4-video-thumb", {}, async (env) => {
  const c = checker(env)
  const list = await olPost("/api/fs/list", { path: `${MOUNT}/预览`, refresh: false }, token)
  const v = (list?.content ?? []).find((o) => o.name === "示例视频.mp4")
  c("the video has a thumbnail address", !!v?.thumb, v)
  const r = v?.thumb ? await fetch(v.thumb.startsWith("http") ? v.thumb : OL + v.thumb) : null
  const body = r && !r.ok ? (await r.text()).slice(0, 300) : ""
  c("which answers with a picture", r?.status === 200 && /^image\//.test(r.headers.get("content-type") ?? ""), { status: r?.status, type: r?.headers.get("content-type"), body })
  c.done()
})

// a group's advanced part with fewer than two items is not folded: the share
// dialog's access group shows its one rarely used item in line
await spec("p4-advanced-flat", {}, async (env) => {
  const { page } = env
  const c = checker(env)
  await go(page, `${MOUNT}/文档`, 1200)
  await selectRows(page, "笔记.txt", false)
  await page.locator('[data-selection-bar] [data-action="share"]').click()
  const dialog = page.locator('[data-testid="share-dialog"]')
  c("the share dialog opens", await dialog.waitFor({ timeout: 5000 }).then(() => true, () => false))
  c("Who can open it has no Advanced (1)", (await dialog.locator('[data-testid="advanced-access"]').count()) === 0)
  c("its one item is in sight", await dialog.locator('[data-field="burn_after_read"]').isVisible())
  c("a group of more still folds", (await dialog.locator('[data-testid="advanced-page"]').count()) === 1)
  // an empty share code says what it means (OP internal/model/sharing.go:55, :72)
  const ph = await dialog.locator('[data-field="pwd"] input').getAttribute("placeholder")
  // (a key not yet written reads as /^$/: an empty placeholder must not pass)
  c("an empty share code says anyone with the link can open it", !!ph && tr("shares.pwd_empty").test(ph), ph)
  await page.goto(OL + "/@manage/shares/add", { waitUntil: "domcontentloaded" })
  const ph2 = await page.locator("input#pwd").getAttribute("placeholder", { timeout: 8000 }).catch(() => null)
  c("so does the share form", !!ph2 && tr("shares.pwd_empty").test(ph2), ph2)
  c.done()
})

// P3: Transfer settings is a settings page of its own (PLAN_FE_SYSTEM_UX_1127
// §0.2 设置归位): the task threads, the speed limits, the sync bandwidth and
// each storage's connections per file, each saying what it governs. Traffic's
// old address leads there and the transfers page keeps a way in
await spec("p3-transfer-settings", {}, async (env) => {
  const { page } = env
  const c = checker(env)
  await go(page, "/@manage", 1200)
  await page.locator('[data-setting="transfers"]').click()
  await page.waitForURL(/\/@manage\/settings\/transfer$/, { timeout: 5000 }).catch(() => {})
  c("Transfer settings opens a settings page", /\/@manage\/settings\/transfer$/.test(page.url()), page.url())
  for (const id of ["task-threads", "speed-limits", "sync-bandwidth", "connections"]) {
    const scope = await page.locator(`[data-card="${id}"] [data-scope]`).first().innerText({ timeout: 5000 }).catch(() => "")
    c(`${id} says what it governs`, scope.trim().length > 0, scope)
  }
  const rare = page.locator('[data-field="move_task_threads_num"]')
  c("the rarely changed thread counts are folded", await rare.isHidden())
  await page.locator('[data-testid="advanced-task-threads"]').click()
  c("and open on a click", await rare.waitFor({ state: "visible", timeout: 3000 }).then(() => true, () => false))
  // the sync bandwidth is not a saved setting: it applies at once
  const sync = page.locator('[data-card="sync-bandwidth"]')
  await sync.locator('[data-testid="bwlimit-input"]').fill("10M")
  await sync.locator('[data-testid="bwlimit-apply"]').click()
  c("the sync bandwidth is set at once", await sync.locator('[data-testid="bwlimit-current"]', { hasText: "10.0 MiB/s" }).waitFor({ timeout: 5000 }).then(() => true, () => false))
  const bw = await olGet("/api/admin/sync/bwlimit", token).catch((e) => String(e))
  c("on the server", bw?.bytes_per_second === 10485760, bw)
  await olPost("/api/admin/sync/bwlimit", { rate: "off" }, token).catch(() => {})
  c("connections per file is only shown here", (await page.locator('[data-card="connections"] input').count()) === 0)
  await go(page, "/@manage/settings/traffic", 1500)
  c("the old Traffic address leads here", /\/@manage\/settings\/transfer$/.test(page.url()), page.url())
  await go(page, "/@transfers", 1500)
  const link = page.locator('[data-testid="transfer-settings-link"]')
  c("the transfers page keeps a way in", await link.isVisible().catch(() => false))
  c.done()
})

// P3: the long settings pages in cards by what they act on (research 05 §二):
// each card says what it governs and folds its rare settings under Advanced;
// the settings search finds a folded one and opens its group on the page
await spec("p3-settings-search", {}, async (env) => {
  const { page } = env
  const c = checker(env)
  await go(page, "/@manage/settings/global", 1500)
  const cards = await page.locator("[data-card]").evaluateAll((l) => l.map((e) => [e.getAttribute("data-card"), (e.querySelector("[data-scope]")?.textContent ?? "").trim().length > 0]))
  c("Global is in cards by what they act on", cards.length >= 4 && cards.every(([, scoped]) => scoped), cards)
  c("nothing is left over", (await page.locator('[data-card="rest"]').count()) === 0)
  const key = "ignore_direct_link_params"
  c("a rare one is folded", await page.locator(`[data-field="${key}"]`).isHidden())
  await go(page, "/@manage", 1200)
  await page.getByRole("searchbox").fill(key)
  const hit = page.locator(`a[data-setting-hit="${key}"]`)
  c("the search finds it", await hit.waitFor({ timeout: 3000 }).then(() => true, () => false))
  await hit.click()
  await page.waitForURL(/\/@manage\/settings\/global\?focus=/, { timeout: 5000 }).catch(() => {})
  c("and leads to its page", new RegExp(`/@manage/settings/global\\?focus=${key}$`).test(page.url()), page.url())
  const field = page.locator(`[data-field="${key}"]`)
  c("its group opens by itself", await field.waitFor({ state: "visible", timeout: 5000 }).then(() => true, () => false))
  c("and it is marked", (await field.getAttribute("data-focused")) !== null)
  c.done()
})

// P3: the dialogs with two or more rarely changed options fold them under
// Advanced (05 §一; counted in PLAN_FE_SYSTEM_UX_1127 P3): Decompress, the
// upload panel and Generate transfer seed. What is asked every time stays out
const foldsIn = async (c, dialog, testid, common, rare) => {
  const group = dialog.locator(`[data-testid="${testid}"]`)
  const there = await group.waitFor({ timeout: 5000 }).then(() => true, () => false)
  c(`${testid}: the Advanced title is in sight`, there)
  for (const key of common) c(`${testid}: ${key} stays out`, await dialog.getByText(tr(key)).first().isVisible())
  for (const key of rare) c(`${testid}: ${key} is folded`, await dialog.getByText(tr(key)).first().isHidden())
  if (!there) return
  await group.click()
  for (const key of rare) c(`${testid}: ${key} shows on a click`, await dialog.getByText(tr(key)).first().waitFor({ state: "visible", timeout: 3000 }).then(() => true, () => false))
}
const moreActions = async (page, name, action) => {
  await go(page, `${MOUNT}/文档`, 1200)
  await item(page, name).click({ button: "right" })
  await page.locator('[role="menu"]').getByRole("menuitem", { name: tr("files.more_actions") }).first().hover()
  const sub = page.locator('[role="menu"]').nth(1)
  await sub.waitFor()
  await sub.getByRole("menuitem", { name: tr(action) }).first().click()
  return page.locator('[role="dialog"]').last()
}
await spec("p3-dialog-advanced", {}, async (env) => {
  const { page } = env
  const c = checker(env)
  let dialog = await moreActions(page, "压缩包.zip", "home.toolbar.decompress")
  await foldsIn(c, dialog, "advanced-decompress", ["home.toolbar.decompress-pass", "home.conflict_policy.overwrite_existing"], ["home.toolbar.decompress-cache-full", "home.toolbar.decompress-put-into-new"])
  await page.keyboard.press("Escape")
  dialog = await moreActions(page, "笔记", "home.toolbar.generate_transfer_seed")
  await foldsIn(c, dialog, "advanced-seed", ["home.transfer_seed.formats", "home.transfer_seed.seed_name", "home.transfer_seed.output_path"], ["home.transfer_seed.hash_matrix", "home.transfer_seed.piece_size", "home.transfer_seed.comment"])
  await page.keyboard.press("Escape")
  // the upload panel opens its file picker as it mounts: let it come and go
  await go(page, `${MOUNT}/文档`, 1200)
  const chooser = page.waitForEvent("filechooser", { timeout: 3000 }).catch(() => null)
  await page.locator("[data-files-new]").click()
  await page.locator('[role="menuitem"][data-action="upload"]').click()
  await chooser
  dialog = page.locator('[role="dialog"]').last()
  await foldsIn(c, dialog, "advanced-upload", ["home.upload.add_as_task", "home.upload.try_rapid"], ["home.upload.sidecars"])
  c.done()
})

// P3: the storage form shows the required items and the ones not at their
// default; the rest of each section is folded under Advanced. The seed's
// Local storage sets its mount path and thumbnails (lib.mjs addStorage); the
// WebDAV policy is required (OP internal/op/driver.go getMainItems); Local has
// no cache time (OP drivers/local/meta.go NoCache)
await spec("p3-storage-advanced", {}, async (env) => {
  const { page } = env
  const c = checker(env)
  const list = await olGet("/api/admin/storage/list", token)
  const local = (list.content ?? []).find((s) => s.mount_path === MOUNT)
  c("the seed's storage is there", !!local, (list.content ?? []).map((s) => s.mount_path))
  await go(page, `/@manage/storages/edit/${local?.id}`, 1500)
  const f = (key) => page.locator(`[data-field="${key}"]`)
  await f("mount_path").waitFor({ timeout: 8000 }).catch(() => {})
  for (const key of ["mount_path", "webdav_policy", "root_folder_path", "thumbnail"]) c(`${key} is in sight`, await f(key).isVisible())
  for (const key of ["remark", "disable_index"]) c(`${key}, at its default, is folded`, await f(key).isHidden())
  const common = page.locator('[data-testid="advanced-storage-common"]')
  c("the common section has an Advanced title", await common.isVisible())
  await common.click().catch(() => {})
  c("which opens on a click", await f("remark").waitFor({ state: "visible", timeout: 3000 }).then(() => true, () => false))
  c.done()
})

fs.writeFileSync(path.join(out, "bugs.json"), JSON.stringify(results, null, 1))
await browser.close()
await chromeBrowser?.close()
const failed = results.filter((r) => !r.ok)
log(`${results.length - failed.length}/${results.length} specs passed`)
process.exit(failed.length ? 1 : 0)
