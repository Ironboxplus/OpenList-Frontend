// Screenshots of Cloudreve's and OpenList's file browser over the same sample
// files (see .github/workflows/ui-compare.yml). Every step is best effort: a
// failed step is logged and the run goes on, so one run shows as much as it can.
// usage: node shoot.mjs <out dir>   env: SAMPLES, OL_PASS, CR_PASS
import { chromium } from "playwright"
import fs from "node:fs"
import path from "node:path"

const out = process.argv[2]
fs.mkdirSync(out, { recursive: true })
const OL = "http://127.0.0.1:5244"
const CR = "http://127.0.0.1:5212"
const DESKTOP = { width: 1440, height: 900 }
const MOBILE = { width: 390, height: 844 }

const log = (...a) => console.log("[shoot]", ...a)
async function step(name, fn) {
  try {
    await fn()
    log("ok", name)
  } catch (e) {
    log("FAILED", name, String(e?.message || e).split("\n")[0])
  }
}
const shot = (page, name) =>
  page.screenshot({ path: path.join(out, `${name}.png`) })

async function olApi(p, body, token) {
  const r = await fetch(OL + p, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: token } : {}) },
    body: JSON.stringify(body),
  })
  const j = await r.json()
  if (j.code !== 200) throw new Error(`${p}: ${j.code} ${j.message}`)
  return j.data
}

async function olGet(p, token) {
  const r = await fetch(OL + p, { headers: { Authorization: token } })
  const j = await r.json()
  if (j.code !== 200) throw new Error(`${p}: ${j.code} ${j.message}`)
  return j.data
}

const browser = await chromium.launch()

// ---------- OpenList ----------
let olToken = ""
await step("openlist login + storage", async () => {
  // A fresh server has no admin yet: the first-run setup creates it.
  await olApi("/api/public/init/setup", { username: "admin", password: process.env.OL_PASS, site_title: "OpenList" })
  olToken = (await olApi("/api/auth/login", { username: "admin", password: process.env.OL_PASS })).token
  await olApi(
    "/api/admin/storage/create",
    {
      mount_path: "/示例",
      driver: "Local",
      order: 0,
      cache_expiration: 0,
      webdav_policy: "native_proxy",
      addition: JSON.stringify({ root_folder_path: "/samples", thumbnail: true, show_hidden: true }),
    },
    olToken,
  )
})

// README.md is hidden from listings by default and the welcome announcement
// sits over the first screen; Cloudreve shows neither, so clear both.
await step("openlist settings", async () => {
  for (const key of ["hide_files", "announcement"]) {
    const item = await olGet(`/api/admin/setting/get?key=${key}`, olToken)
    await olApi("/api/admin/setting/save", [{ ...item, value: "" }], olToken)
  }
})

async function openlist(scheme, viewport, tag) {
  const phone = viewport.width < 640
  const ctx = await browser.newContext({ viewport, locale: "zh-CN", colorScheme: scheme })
  await ctx.addInitScript((t) => localStorage.setItem("token", t), olToken)
  const page = await ctx.newPage()
  // runtime errors of our own page show up in the job log
  page.on("pageerror", (e) => log(`pageerror ${tag}`, String(e?.message || e).split("\n")[0]))
  page.on("response", (r) => {
    if (r.status() >= 400) log(`http ${r.status()} ${tag}`, r.url().replace(OL, ""))
  })
  page.on("console", (m) => {
    if (m.type() === "error") log(`console.error ${tag}`, m.text().split("\n")[0].slice(0, 200))
  })
  const item = (name) => page.locator(".viselect-item", { hasText: name }).first()
  await step(`openlist ${tag} root`, async () => {
    await page.goto(OL + "/示例", { waitUntil: "networkidle" })
    await page.waitForTimeout(1500)
    await shot(page, `ol-${tag}-1-root`)
  })
  await step(`openlist ${tag} photos`, async () => {
    await page.goto(OL + "/示例/照片/2026 旅行", { waitUntil: "networkidle" })
    await page.waitForTimeout(2000)
    await shot(page, `ol-${tag}-2-photos`)
  })
  await step(`openlist ${tag} context menu`, async () => {
    await page.goto(OL + "/示例", { waitUntil: "networkidle" })
    await page.waitForTimeout(1000)
    await item("README.md").click({ button: "right" })
    await page.waitForTimeout(600)
    await shot(page, `ol-${tag}-3-context`)
    await page.keyboard.press("Escape")
  })
  await step(`openlist ${tag} multi-select`, async () => {
    await page.goto(OL + "/示例", { waitUntil: "networkidle" })
    await page.waitForTimeout(1000)
    for (const name of ["README.md", "文档", "视频"]) {
      if (phone) {
        // no Ctrl on a phone: a long press enters selection mode, taps add
        const box = await item(name).boundingBox()
        const x = box.x + box.width / 2
        const y = box.y + box.height / 2
        if (name === "README.md") {
          await page.mouse.move(x, y)
          await page.mouse.down()
          await page.waitForTimeout(800)
          await page.mouse.up()
        } else {
          await page.mouse.click(x, y)
        }
      } else {
        await item(name).click({ modifiers: ["Control"] })
      }
    }
    await page.waitForTimeout(600)
    await shot(page, `ol-${tag}-4-selected`)
  })
  // Beyond what Cloudreve is shot for: the list view, the New menu and the
  // other sections of the shell, to see that nothing else broke.
  if (tag === "light") {
    // Shift-click selects a range, a drag draws a rectangle (real mouse input).
    await step(`openlist ${tag} shift range`, async () => {
      await page.goto(OL + "/示例/照片/2026 旅行", { waitUntil: "networkidle" })
      await page.waitForTimeout(1000)
      await item("IMG_001").click({ modifiers: ["Control"] })
      await item("IMG_004").click({ modifiers: ["Shift"] })
      await page.waitForTimeout(500)
      await shot(page, `ol-${tag}-8-shift`)
    })
    await step(`openlist ${tag} marquee`, async () => {
      await page.goto(OL + "/示例/照片/2026 旅行", { waitUntil: "networkidle" })
      await page.waitForTimeout(1000)
      const a = await item("IMG_001").boundingBox()
      const b = await item("IMG_002").boundingBox()
      // from the gap right of the first card to the middle of the second
      await page.mouse.move(a.x + a.width + 8, a.y + 40)
      await page.mouse.down()
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 10 })
      await shot(page, `ol-${tag}-9-marquee`)
      await page.mouse.up()
    })
    // Files, pressed after another section, returns to the folder and scroll
    // it was left at; a short window makes the six cards scroll.
    await step(`openlist ${tag} files nav restore`, async () => {
      await page.setViewportSize({ width: viewport.width, height: 460 })
      await page.goto(OL + "/示例/照片/2026 旅行", { waitUntil: "networkidle" })
      await page.waitForTimeout(1000)
      await page.mouse.move(700, 300)
      await page.mouse.wheel(0, 220)
      await page.waitForTimeout(800)
      const before = await page.evaluate(() => Math.round(scrollY))
      await page.locator('[data-nav-id="transfers"]').first().click()
      await page.waitForTimeout(1500)
      await page.locator('[data-nav-id="files"]').first().click()
      await page.waitForTimeout(2500)
      const after = await page.evaluate(() => Math.round(scrollY))
      log(`restore ${tag}`, `url=${decodeURIComponent(new URL(page.url()).pathname)} scroll before=${before} after=${after}`)
      await shot(page, `ol-${tag}-10-restored`)
      if (!before || Math.abs(before - after) > 2) throw new Error(`scroll not restored: ${before} -> ${after}`)
      await page.setViewportSize(viewport)
    })
  }
  await step(`openlist ${tag} list view`, async () => {
    await page.goto(OL + "/示例/照片/2026 旅行", { waitUntil: "networkidle" })
    await page.waitForTimeout(1000)
    await page.locator("[data-files-view]").click()
    await page.getByRole("menuitem", { name: /List View|列表视图/ }).click()
    await page.waitForTimeout(1500)
    await shot(page, `ol-${tag}-5-list`)
  })
  if (!phone) {
    await step(`openlist ${tag} new menu`, async () => {
      await page.goto(OL + "/示例", { waitUntil: "networkidle" })
      await page.waitForTimeout(1000)
      await page.locator("[data-files-new]").click()
      await page.waitForTimeout(500)
      await shot(page, `ol-${tag}-6-newmenu`)
    })
  }
  if (tag === "light" || tag === "mobile") {
    for (const [name, route] of [
      ["dashboard", "/@dashboard"],
      ["transfers", "/@transfers"],
      ["manage", "/@manage"],
    ]) {
      await step(`openlist ${tag} ${name}`, async () => {
        await page.goto(OL + route, { waitUntil: "networkidle" })
        await page.waitForTimeout(1500)
        await shot(page, `ol-${tag}-7-${name}`)
      })
    }
  }
  await ctx.close()
}

// ---------- Cloudreve ----------
const CR_EMAIL = "ui-compare@example.com"
async function crLogin(page) {
  await page.goto(CR + "/session", { waitUntil: "networkidle" })
  await page.locator('input[type="email"], input[name="email"], input[type="text"]').first().fill(CR_EMAIL)
  await page.getByRole("button", { name: "下一步" }).click()
  await page.locator('input[type="password"]').first().waitFor({ timeout: 15000 })
  await page.locator('input[type="password"]').first().fill(process.env.CR_PASS)
  await page.getByRole("button", { name: "登录" }).click()
  await page.waitForURL(/\/home/, { timeout: 20000 })
}

await step("cloudreve signup + upload", async () => {
  const ctx = await browser.newContext({ viewport: DESKTOP, locale: "zh-CN" })
  const page = await ctx.newPage()
  await page.goto(CR + "/session/signup", { waitUntil: "networkidle" })
  await page.locator('input[type="email"], input[name="email"], input[type="text"]').first().fill(CR_EMAIL)
  const pw = page.locator('input[type="password"]')
  for (let i = 0; i < (await pw.count()); i++) await pw.nth(i).fill(process.env.CR_PASS)
  await page.getByRole("button", { name: "注册" }).click()
  await page.waitForTimeout(3000)
  await shot(page, "cr-0-signup")
  if (!/\/home/.test(page.url())) await crLogin(page)
  await page.waitForTimeout(2000)
  // 新建 → 上传目录 opens a directory chooser; hand it the whole sample tree.
  await page.getByRole("button", { name: "新建" }).click()
  const chooser = page.waitForEvent("filechooser", { timeout: 15000 })
  await page.getByText("上传目录", { exact: true }).click()
  await (await chooser).setFiles(process.env.SAMPLES)
  await page.waitForTimeout(15000)
  await shot(page, "cr-0-uploaded")
  await ctx.storageState({ path: path.join(out, "..", "cr-state.json") })
  await ctx.close()
})

async function cloudreve(scheme, viewport, tag) {
  const statePath = path.join(out, "..", "cr-state.json")
  const ctx = await browser.newContext({
    viewport,
    locale: "zh-CN",
    colorScheme: scheme,
    ...(fs.existsSync(statePath) ? { storageState: statePath } : {}),
  })
  const page = await ctx.newPage()
  const at = (p) => CR + "/home?path=" + encodeURIComponent("cloudreve://my" + p)
  const root = path.basename(process.env.SAMPLES)
  await step(`cloudreve ${tag} root`, async () => {
    await page.goto(at("/" + root), { waitUntil: "networkidle" })
    if (/\/session/.test(page.url())) {
      await crLogin(page)
      await page.goto(at("/" + root), { waitUntil: "networkidle" })
    }
    await page.waitForTimeout(2000)
    await shot(page, `cr-${tag}-1-root`)
  })
  await step(`cloudreve ${tag} photos`, async () => {
    await page.goto(at(`/${root}/照片/2026 旅行`), { waitUntil: "networkidle" })
    await page.waitForTimeout(3000)
    await shot(page, `cr-${tag}-2-photos`)
  })
  await step(`cloudreve ${tag} context menu`, async () => {
    await page.goto(at("/" + root), { waitUntil: "networkidle" })
    await page.waitForTimeout(1500)
    await page.getByText("README.md", { exact: true }).first().click({ button: "right" })
    await page.waitForTimeout(600)
    await shot(page, `cr-${tag}-3-context`)
    await page.keyboard.press("Escape")
  })
  await step(`cloudreve ${tag} multi-select`, async () => {
    for (const name of ["README.md", "文档", "视频"]) {
      await page.getByText(name, { exact: true }).first().click({ modifiers: ["Control"] })
    }
    await page.waitForTimeout(600)
    await shot(page, `cr-${tag}-4-selected`)
  })
  await ctx.close()
}

for (const [scheme, vp, tag] of [
  ["light", DESKTOP, "light"],
  ["dark", DESKTOP, "dark"],
  ["light", MOBILE, "mobile"],
  // the rail layout only we have; nothing to compare it with
  ["light", { width: 820, height: 1000 }, "tablet"],
]) {
  await openlist(scheme, vp, tag)
  if (tag !== "tablet") await cloudreve(scheme, vp, tag)
}

await browser.close()
