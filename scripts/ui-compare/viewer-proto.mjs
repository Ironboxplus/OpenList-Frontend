// The viewer prototype (design/viewer-proto) against the real OpenList of
// .github/workflows/viewer-proto.yml: screenshots at three widths in light and
// dark, one recording per animation (and the same with reduced motion), the
// measured animation timings, and the checks the design asks for (the player
// is never remounted, fullscreen works, Back/refresh/deep links, one-click
// downloads). Writes into <out>: shots/, videos/, motion/, checks.json and
// summary.md. Exits 1 when a check fails.
// usage: node viewer-proto.mjs <out>
import fs from "node:fs"
import path from "node:path"
import { chromium } from "playwright"
import { log, seed, step } from "./lib.mjs"

const OUT = path.resolve(process.argv[2] || "proto-out")
const PROTO = process.env.PROTO_URL || "http://127.0.0.1:4173"
const DIR = "/审计/查看器"
const SEASON = "/审计/媒体库/剧集乙 (2021)/Season 1"
const V1 = "01 示例视频.mp4"
const V2 = "02 示例视频.mp4"
const V3 = "03 示例视频.mp4"
const IMG1 = "照片_01.jpg"
const TEXT = "长文本.txt"
const PDF = "报告.pdf"
const UNKNOWN = "数据.bin"

const WIDTHS = [
  { name: "1440", viewport: { width: 1440, height: 900 } },
  { name: "820", viewport: { width: 820, height: 1180 }, hasTouch: true },
  { name: "390", viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true },
]

for (const d of ["shots", "videos", "motion"]) fs.mkdirSync(path.join(OUT, d), { recursive: true })

const checks = []
const check = (name, ok, detail = "") => {
  checks.push({ name, ok: !!ok, detail: typeof detail === "string" ? detail : JSON.stringify(detail) })
  log(ok ? "PASS" : "FAIL", name, typeof detail === "string" ? detail : JSON.stringify(detail))
}

const url = (p) => PROTO + encodeURI(p)

async function launch() {
  const args = ["--autoplay-policy=no-user-gesture-required"]
  // Desktop Chrome, as the design asks for the fullscreen test (and its H.264);
  // the bundled Chromium only when the runner has no Chrome.
  try {
    return await chromium.launch({ channel: "chrome", args })
  } catch (e) {
    log("no system Chrome, using the bundled Chromium:", String(e.message).split("\n")[0])
    return chromium.launch({ args })
  }
}

let TOKEN = ""
async function newContext(browser, w, opts = {}) {
  const ctx = await browser.newContext({
    viewport: w.viewport,
    hasTouch: !!w.hasTouch,
    isMobile: !!w.isMobile,
    deviceScaleFactor: 1,
    colorScheme: opts.theme ?? "light",
    reducedMotion: opts.reduced ? "reduce" : "no-preference",
    locale: "zh-CN",
    acceptDownloads: true,
    ...(opts.video ? { recordVideo: { dir: path.join(OUT, "videos", "raw"), size: w.viewport } } : {}),
  })
  // The token stays in the browser; nothing written out carries it.
  await ctx.addInitScript((token) => {
    localStorage.setItem("token", token)
    window.__moviRemoved = 0
    new MutationObserver((ms) => {
      for (const m of ms)
        for (const n of m.removedNodes)
          if (n.nodeType === 1 && (n.matches?.("movi-player") || n.querySelector?.("movi-player")))
            window.__moviRemoved++
    }).observe(document, { childList: true, subtree: true })
  }, TOKEN)
  return ctx
}

/** Finite animations have ended (movi's spinners and the like run forever). */
const settle = (page) =>
  page
    .waitForFunction(
      () =>
        document
          .getAnimations()
          .every((a) => a.playState !== "running" || a.effect?.getComputedTiming().iterations === Infinity),
      undefined,
      { timeout: 15000 },
    )
    .catch(() => log("animations still running after 15s"))

const row = (page, name) => page.locator(`[data-testid=row][data-path$="/${name}"]`)

const identity = (page) =>
  page.evaluate(() => ({
    created: window.__moviCreated ?? 0,
    count: document.querySelectorAll("movi-player").length,
    same: !!window.__player && document.querySelector("movi-player") === window.__player,
    removed: window.__moviRemoved ?? 0,
    src: window.__player?.getAttribute("src") ?? "",
    fullscreen: !!window.__player && document.fullscreenElement === window.__player,
  }))

const playing = (page) =>
  page
    .waitForFunction(() => (window.__player?.currentTime ?? 0) > 0.3, undefined, { timeout: 60000 })
    .then(
      () => true,
      () => false,
    )

const openList = async (page, p = DIR) => {
  await page.goto(url(p))
  await page.waitForSelector("[data-testid=row]")
  await settle(page)
}

const shot = (page, w, theme, name) =>
  page.screenshot({ path: path.join(OUT, "shots", `${w.name}-${theme}-${name}.png`) })

const scrollTo = (page, y) =>
  page.evaluate(
    (y) =>
      new Promise((done) => {
        window.scrollTo(0, y)
        // the IntersectionObserver reports in the frames after the scroll
        requestAnimationFrame(() => requestAnimationFrame(() => done()))
      }),
    y,
  )
const waitAttr = (page, sel) =>
  page.waitForSelector(sel, { timeout: 5000 }).then(
    () => true,
    () => false,
  )

async function fullscreen(page) {
  await page.locator("movi-player").hover()
  const btn = page.locator("movi-player .movi-fullscreen-btn")
  try {
    await btn.click({ force: true, timeout: 5000 })
  } catch {
    await page.evaluate(() => window.__player.focus())
    await page.keyboard.press("f")
  }
  return page
    .waitForFunction(() => document.fullscreenElement === window.__player, undefined, { timeout: 10000 })
    .then(
      () => true,
      () => false,
    )
}

const downloads = async (page, what, act) => {
  const pagesBefore = page.context().pages().length
  try {
    const [d] = await Promise.all([page.waitForEvent("download", { timeout: 15000 }), act()])
    check(`download from ${what}`, page.context().pages().length === pagesBefore, d.suggestedFilename())
  } catch (e) {
    check(`download from ${what}`, false, String(e.message).split("\n")[0])
  }
}

const dumpMotion = async (page, name) => {
  const m = await page.evaluate(() => window.__motion ?? [])
  fs.writeFileSync(path.join(OUT, "motion", `${name}.json`), JSON.stringify(m, null, 1))
  return m
}

// ---------- screenshots: three widths x two themes ----------
async function screenshots(browser, w, theme) {
  const ctx = await newContext(browser, w, { theme })
  const page = await ctx.newPage()
  const tag = `${w.name}/${theme}`
  await openList(page)
  await shot(page, w, theme, "01-list")

  await row(page, V1).click()
  await page.waitForSelector("[data-testid=dock][data-open=true]")
  await settle(page)
  await playing(page)
  await page.evaluate(() => window.__player?.pause())
  await shot(page, w, theme, "02-dock")

  await scrollTo(page, 1200)
  await page.waitForSelector("[data-testid=dock][data-mini=true]", { timeout: 5000 }).catch(() => {})
  await settle(page)
  await shot(page, w, theme, "03-dock-mini")
  await scrollTo(page, 0)
  await settle(page)
  await page.locator("[data-testid=dock-close]").click()
  await page.waitForSelector("[data-testid=dock][data-open=false]")
  await settle(page)

  await row(page, IMG1).click()
  await page.waitForSelector("[data-testid=viewer-image]")
  await settle(page)
  await shot(page, w, theme, "04-image")
  await page.keyboard.press("Escape")
  await page.waitForSelector("[data-testid=image-viewer]", { state: "detached" })

  await row(page, TEXT).click()
  await page.waitForSelector("[data-testid=doc-text]")
  await settle(page)
  await shot(page, w, theme, "05-text")
  await page.keyboard.press("Escape")
  await page.waitForSelector("[data-testid=doc-viewer]", { state: "detached" })

  await row(page, PDF).click()
  await page.waitForSelector("[data-testid=doc-pdf]")
  await page.waitForTimeout(2500) // pdfium draws the page after its wasm loads; this is a picture, not a check
  await settle(page)
  await shot(page, w, theme, "06-pdf")
  await page.keyboard.press("Escape")
  await page.waitForSelector("[data-testid=doc-viewer]", { state: "detached" })

  await row(page, UNKNOWN).click()
  await page.waitForSelector("[data-testid=unknown-dialog]")
  await settle(page)
  await shot(page, w, theme, "07-unknown")
  await page.keyboard.press("Escape")
  await page.waitForSelector("[data-testid=unknown-dialog]", { state: "detached" })

  await row(page, TEXT).click({ button: "right" })
  await page.waitForSelector("[data-testid=context-menu]")
  await settle(page)
  await shot(page, w, theme, "08-context-menu")
  await page.keyboard.press("Escape")
  await settle(page)

  await row(page, IMG1).locator("button[aria-pressed]").click()
  await row(page, TEXT).locator("button[aria-pressed]").click()
  await page.waitForSelector("[data-testid=selection-bar]")
  await settle(page)
  await shot(page, w, theme, "09-selection-bar")
  await page.getByRole("button", { name: "分享", exact: true }).click()
  await page.waitForSelector("[data-testid=share-dialog]")
  await settle(page)
  await shot(page, w, theme, "10-share")
  await page.locator("[data-testid=share-search]").fill("排序")
  await settle(page)
  await shot(page, w, theme, "11-share-search")
  await page.keyboard.press("Escape")
  await settle(page)

  await openList(page, SEASON)
  const ep = page.locator("[data-testid=row][data-kind=video]").first()
  await ep.click()
  await page.waitForSelector("[data-testid=dock][data-open=true]")
  await settle(page)
  await playing(page)
  await page.evaluate(() => window.__player?.pause())
  const bar = await page.locator("[data-testid=episode-bar]").count()
  if (theme === "light") check(`episode bar in a media library work (${w.name})`, bar === 1)
  await shot(page, w, theme, "12-episode-bar")
  log("shots done", tag)
  await ctx.close()
}

// ---------- the checks of the docked player, URL and downloads ----------
async function behaviour(browser) {
  const w = WIDTHS[0]
  const ctx = await newContext(browser, w)
  const page = await ctx.newPage()
  await openList(page)
  await scrollTo(page, 300)
  const hist0 = await page.evaluate(() => history.length)

  await row(page, V1).click()
  await page.waitForSelector("[data-testid=dock][data-open=true]")
  await settle(page)
  check("video opens in the dock and pushes /<dir>/<file>", decodeURI(new URL(page.url()).pathname) === `${DIR}/${V1}`)
  check("open pushed one history entry", (await page.evaluate(() => history.length)) === hist0 + 1)
  check("video plays (system Chrome, real OpenList)", await playing(page))
  let id = await identity(page)
  check("one movi-player made", id.created === 1 && id.count === 1 && id.same, id)
  check("playing row marked", (await row(page, V1).getAttribute("aria-current")) === "true")
  const src1 = id.src

  await scrollTo(page, 1200)
  check("scrolled away: the dock shrinks to the pinned window", await waitAttr(page, "[data-testid=dock][data-mini=true]"))
  id = await identity(page)
  check("shrinking does not remount the player", id.created === 1 && id.removed === 0 && id.same, id)
  check("fullscreen from the mini window", await fullscreen(page))
  await page.evaluate(() => document.exitFullscreen())
  await page.waitForFunction(() => !document.fullscreenElement)
  await scrollTo(page, 0)
  await settle(page)
  check("scrolled back: the dock grows back", await waitAttr(page, "[data-testid=dock][data-mini=false]"))

  const histBefore = await page.evaluate(() => history.length)
  await page.locator("[data-testid=dock-next]").click()
  await page.waitForFunction((src) => (window.__player?.getAttribute("src") ?? "") !== src, src1)
  id = await identity(page)
  check("next switches the source on the same element", id.created === 1 && id.removed === 0 && id.same && id.src !== src1, id)
  check("next replaces the URL", decodeURI(new URL(page.url()).pathname) === `${DIR}/${V2}` && (await page.evaluate(() => history.length)) === histBefore)
  check("highlight follows", (await row(page, V2).getAttribute("aria-current")) === "true" && (await row(page, V1).getAttribute("aria-current")) === null)

  await row(page, V3).click()
  await page.waitForFunction(() => decodeURI(location.pathname).endsWith("03 示例视频.mp4"))
  check("a click on another video row switches, replacing the URL", (await page.evaluate(() => history.length)) === histBefore)
  await page.keyboard.press("Shift+P")
  await page.waitForFunction(() => decodeURI(location.pathname).endsWith("02 示例视频.mp4"))
  check("Shift+P goes back one video", true)

  check("fullscreen from the dock", await fullscreen(page))
  const srcFs = (await identity(page)).src
  await page.evaluate(() => window.__player.focus())
  await page.keyboard.press("Shift+N")
  const switched = await page
    .waitForFunction((src) => (window.__player?.getAttribute("src") ?? "") !== src, srcFs, { timeout: 10000 })
    .then(() => true, () => false)
  id = await identity(page)
  check("Shift+N in fullscreen switches the video and stays fullscreen", switched && id.fullscreen && id.same, id)
  await page.evaluate(() => document.fullscreenElement && document.exitFullscreen())
  await page.waitForFunction(() => !document.fullscreenElement)

  await page.goBack()
  await page.waitForSelector("[data-testid=dock][data-open=false]")
  await settle(page)
  const y = await page.evaluate(() => window.scrollY)
  check("one Back closes the player and restores the list scroll", decodeURI(new URL(page.url()).pathname) === DIR && Math.abs(y - 300) < 4, `scrollY=${y}`)
  id = await identity(page)
  check("closing keeps the same player element", id.created === 1 && id.removed === 0 && id.same, id)

  // image viewer: push on open, replace on switch, Back closes
  const h1 = await page.evaluate(() => history.length)
  await row(page, IMG1).click()
  await page.waitForSelector("[data-testid=viewer-image]")
  await settle(page)
  await page.keyboard.press("ArrowRight")
  await page.waitForFunction(() => document.querySelector("[data-testid=image-index]")?.textContent?.startsWith("2 /"))
  check("image: → switches and replaces the URL", decodeURI(new URL(page.url()).pathname) === `${DIR}/照片_02.jpg`)
  await downloads(page, "the image viewer toolbar", () => page.locator("[data-testid=viewer-download]").click())
  await page.locator("[data-testid=viewer-close]").click()
  await page.waitForSelector("[data-testid=image-viewer]", { state: "detached" })
  check("image: closing goes back to the folder URL, no extra history", decodeURI(new URL(page.url()).pathname) === DIR && (await page.evaluate(() => history.length)) === h1 + 1)
  const m = await dumpMotion(page, "behaviour")
  const open = m.find((r) => r.name === "image-open")
  check("image open is a FLIP from the thumbnail (emphasized, 320ms)", open && open.duration === 320 && /0\.05, 0\.7, 0\.1, 1/.test(open.easing), open)

  // downloads from the list, the menu and the selection bar; doc and unknown viewers
  await row(page, TEXT).hover()
  await downloads(page, "the row's button", () => row(page, TEXT).locator("[data-testid=row-download]").click())
  await row(page, TEXT).click({ button: "right" })
  await downloads(page, "the context menu", () => page.locator("[data-testid=menu-download]").click())
  await settle(page)
  await row(page, PDF).locator("button[aria-pressed]").click()
  await downloads(page, "the selection bar", () => page.locator("[data-testid=bar-download]").click())
  await page.getByRole("button", { name: "取消选择", exact: true }).click()
  await row(page, TEXT).click()
  await page.waitForSelector("[data-testid=doc-text]")
  await downloads(page, "the text viewer toolbar", () => page.locator("[data-testid=viewer-download]").click())
  await page.keyboard.press("Escape")
  await page.waitForSelector("[data-testid=doc-viewer]", { state: "detached" })
  await row(page, UNKNOWN).click()
  await page.waitForSelector("[data-testid=unknown-dialog]")
  await downloads(page, "the unknown-type dialog", () => page.locator("[data-testid=unknown-download]").click())
  await page.keyboard.press("Escape")
  await row(page, V1).click()
  await page.waitForSelector("[data-testid=dock][data-open=true]")
  await downloads(page, "the player toolbar", () => page.locator("[data-testid=dock-download]").click())
  await ctx.close()

  // refresh and deep links: the folder first, then the file
  const ctx2 = await newContext(browser, w)
  const p2 = await ctx2.newPage()
  await p2.goto(url(`${DIR}/${V2}`))
  await p2.waitForSelector("[data-testid=row]")
  await p2.waitForSelector("[data-testid=dock][data-open=true]")
  check("deep link to a video: folder listed, dock opened on it", (await p2.locator("[data-testid=dock-title]").textContent())?.trim() === V2)
  await p2.reload()
  await p2.waitForSelector("[data-testid=dock][data-open=true]")
  check("refresh reopens the same video", (await p2.locator("[data-testid=dock-title]").textContent())?.trim() === V2)
  const hd = await p2.evaluate(() => history.length)
  await p2.locator("[data-testid=dock-close]").click()
  await p2.waitForSelector("[data-testid=dock][data-open=false]")
  check("closing a deep-linked file replaces its URL with the folder's", decodeURI(new URL(p2.url()).pathname) === DIR && (await p2.evaluate(() => history.length)) === hd)
  await p2.goto(url(`${DIR}/${IMG1}`))
  await p2.waitForSelector("[data-testid=viewer-image]")
  check("deep link to an image opens the image viewer over its folder", (await p2.locator("[data-testid=row]").count()) > 10)
  await ctx2.close()

  // phone: swipe between images
  const wp = WIDTHS[2]
  const ctx3 = await newContext(browser, wp)
  const p3 = await ctx3.newPage()
  await openList(p3)
  await row(p3, IMG1).click()
  await p3.waitForSelector("[data-testid=viewer-image]")
  await settle(p3)
  await p3.evaluate(() => {
    const st = document.querySelector("[data-testid=image-stage]")
    const r = st.getBoundingClientRect()
    const y = r.top + r.height / 2
    const ev = (type, x) =>
      st.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 7, pointerType: "touch", clientX: x, clientY: y, isPrimary: true }))
    ev("pointerdown", r.right - 40)
    for (let x = r.right - 60; x > r.left + 60; x -= 40) ev("pointermove", x)
    ev("pointerup", r.left + 60)
  })
  const swiped = await p3
    .waitForFunction(() => document.querySelector("[data-testid=image-index]")?.textContent?.startsWith("2 /"), undefined, { timeout: 5000 })
    .then(() => true, () => false)
  check("phone: a swipe moves to the next image", swiped)
  await ctx3.close()
}

// ---------- recordings ----------
async function record(browser, name, w, reduced, flow) {
  const ctx = await newContext(browser, w, { video: true, reduced })
  const page = await ctx.newPage()
  try {
    await flow(page, w)
  } catch (e) {
    check(`recording ${name} ran`, false, String(e.message).split("\n")[0])
  }
  const m = await dumpMotion(page, name).catch(() => [])
  if (reduced) {
    const long = m.filter((r) => !r.cancelled && r.duration > 100)
    check(`reduced motion: every animation of ${name} is <=100ms`, long.length === 0, long.slice(0, 5))
  }
  const v = page.video()
  await ctx.close()
  if (v) await v.saveAs(path.join(OUT, "videos", `${name}.webm`))
}

const videoFlow = async (page) => {
  await openList(page)
  await page.waitForTimeout(600)
  await row(page, V1).click()
  await page.waitForSelector("[data-testid=dock][data-open=true]")
  await playing(page)
  await settle(page)
  await page.waitForTimeout(800)
  for (let i = 0; i < 12; i++) {
    await page.mouse.wheel(0, 120)
    await page.waitForTimeout(60)
  }
  await page.waitForSelector("[data-testid=dock][data-mini=true]", { timeout: 5000 }).catch(() => {})
  await settle(page)
  await page.waitForTimeout(800)
  await page.keyboard.press("Shift+N")
  await page.waitForFunction(() => decodeURI(location.pathname).endsWith("02 示例视频.mp4"))
  await playing(page)
  await page.waitForTimeout(1200)
  await fullscreen(page)
  await page.waitForTimeout(1500)
  await page.evaluate(() => document.exitFullscreen())
  await page.waitForTimeout(800)
  for (let i = 0; i < 12; i++) {
    await page.mouse.wheel(0, -120)
    await page.waitForTimeout(60)
  }
  await settle(page)
  await page.waitForTimeout(800)
  await page.goBack()
  await settle(page)
  await page.waitForTimeout(800)
}

const imageFlow = async (page) => {
  await openList(page)
  await page.waitForTimeout(600)
  await row(page, IMG1).click()
  await page.waitForSelector("[data-testid=viewer-image]")
  await settle(page)
  await page.waitForTimeout(800)
  await page.keyboard.press("ArrowRight")
  await settle(page)
  await page.waitForTimeout(800)
  await page.keyboard.press("ArrowRight")
  await settle(page)
  await page.waitForTimeout(800)
  await page.keyboard.press("Escape")
  await settle(page)
  await page.waitForTimeout(800)
}

const advancedFlow = async (page) => {
  await openList(page)
  await row(page, TEXT).click({ button: "right" })
  await page.getByRole("menuitem", { name: "分享" }).click()
  await page.waitForSelector("[data-testid=share-dialog]")
  await settle(page)
  await page.waitForTimeout(800)
  await page.locator("[data-testid=advanced-access]").click()
  await settle(page)
  await page.waitForTimeout(600)
  await page.getByText("第一个访客打开后失效").click()
  await page.waitForTimeout(400)
  await page.locator("[data-testid=advanced-access]").click()
  await settle(page)
  await page.waitForTimeout(800)
  await page.locator("[data-testid=share-search]").pressSequentially("排序", { delay: 120 })
  await settle(page)
  await page.waitForTimeout(1200)
  await page.locator("[data-testid=share-search]").fill("")
  await page.locator("[data-testid=advanced-page]").click()
  await settle(page)
  await page.waitForTimeout(800)
}

async function main() {
  const seeded = await step("seed the instance", () => seed(OUT))
  if (!seeded) throw new Error("seeding failed")
  TOKEN = seeded.token
  const browser = await launch()
  log("browser", browser.version())

  await step("behaviour checks", () => behaviour(browser))
  for (const [name, w, flow] of [
    ["video-1440", WIDTHS[0], videoFlow],
    ["video-390", WIDTHS[2], videoFlow],
    ["image-1440", WIDTHS[0], imageFlow],
    ["image-390", WIDTHS[2], imageFlow],
    ["advanced-1440", WIDTHS[0], advancedFlow],
  ]) {
    await step(`record ${name}`, () => record(browser, name, w, false, flow))
    await step(`record ${name} reduced`, () => record(browser, `${name}-reduced`, w, true, flow))
  }
  for (const w of WIDTHS)
    for (const theme of ["light", "dark"])
      await step(`screenshots ${w.name} ${theme}`, () => screenshots(browser, w, theme))
  await browser.close()
  fs.rmSync(path.join(OUT, "videos", "raw"), { recursive: true, force: true })

  // the timings, as asked for and as measured
  const rows = []
  for (const f of fs.readdirSync(path.join(OUT, "motion")).sort()) {
    const recs = JSON.parse(fs.readFileSync(path.join(OUT, "motion", f), "utf8"))
    const seen = new Map()
    for (const r of recs) {
      if (r.cancelled) continue
      const key = `${r.name}|${r.duration}|${r.easing}`
      const s = seen.get(key) ?? { ...r, n: 0, min: Infinity, max: 0 }
      s.n++
      if (r.measured !== undefined) {
        s.min = Math.min(s.min, r.measured)
        s.max = Math.max(s.max, r.measured)
      }
      seen.set(key, s)
    }
    for (const s of seen.values())
      rows.push(`| ${f.replace(".json", "")} | ${s.name} | ${s.duration} | ${s.min === Infinity ? "" : `${s.min}–${s.max}`} | ${s.easing} | ${s.n} |`)
  }
  const failed = checks.filter((c) => !c.ok)
  const md = [
    `# Viewer prototype: ${checks.length - failed.length}/${checks.length} checks pass`,
    "",
    "| check | result | detail |",
    "|---|---|---|",
    ...checks.map((c) => `| ${c.name} | ${c.ok ? "PASS" : "**FAIL**"} | ${c.detail.replace(/\|/g, "\\|").slice(0, 200)} |`),
    "",
    "## Animations (planned ms, measured ms)",
    "",
    "| run | animation | planned | measured | easing | n |",
    "|---|---|---|---|---|---|",
    ...rows,
  ].join("\n")
  fs.writeFileSync(path.join(OUT, "summary.md"), md)
  fs.writeFileSync(path.join(OUT, "checks.json"), JSON.stringify(checks, null, 1))
  log(`${checks.length - failed.length}/${checks.length} checks pass`)
  if (failed.length) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
