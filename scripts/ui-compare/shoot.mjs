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

const browser = await chromium.launch()

// ---------- OpenList ----------
let olToken = ""
await step("openlist login + storage", async () => {
  // A fresh server has no admin yet: the first-run setup creates it.
  await olApi("/api/init/setup", { username: "admin", password: process.env.OL_PASS, site_title: "OpenList" })
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

async function openlist(scheme, viewport, tag) {
  const ctx = await browser.newContext({ viewport, locale: "zh-CN", colorScheme: scheme })
  await ctx.addInitScript((t) => localStorage.setItem("token", t), olToken)
  const page = await ctx.newPage()
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
    await page.getByText("README.md", { exact: true }).first().click({ button: "right" })
    await page.waitForTimeout(600)
    await shot(page, `ol-${tag}-3-context`)
    await page.keyboard.press("Escape")
  })
  await step(`openlist ${tag} multi-select`, async () => {
    const boxes = page.locator('input[type="checkbox"]')
    const n = await boxes.count()
    for (let i = 1; i < Math.min(n, 4); i++) await boxes.nth(i).check({ force: true })
    await page.waitForTimeout(600)
    await shot(page, `ol-${tag}-4-selected`)
  })
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
  // The folder-upload input (webkitdirectory) takes the whole sample tree.
  const dirInput = page.locator("input[type=file][webkitdirectory]")
  if ((await dirInput.count()) > 0) {
    await dirInput.first().setInputFiles(process.env.SAMPLES)
  } else {
    const files = fs.readdirSync(process.env.SAMPLES, { recursive: true })
      .map((f) => path.join(process.env.SAMPLES, f))
      .filter((f) => fs.statSync(f).isFile())
    await page.locator("input[type=file]").first().setInputFiles(files)
  }
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
]) {
  await openlist(scheme, vp, tag)
  await cloudreve(scheme, vp, tag)
}

await browser.close()
