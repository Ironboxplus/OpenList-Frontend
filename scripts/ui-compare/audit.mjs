// Full walk of the frontend in a real browser against a real OpenList (see
// .github/workflows/ui-compare.yml): every route of the router, every dialog the
// menus and bars can open, every preview type, the share-link pages, at three
// widths and in both themes. Per screen it records a screenshot, page and
// console errors, whether the page still answers (page.evaluate within 2 s
// after each action) and the quantitative layout checks of checks.mjs.
// Nothing here fixes or asserts: the output is audit.json and audit.md.
// usage: node audit.mjs <out dir>   env: OL_PASS
import { chromium } from "playwright"
import fs from "node:fs"
import path from "node:path"
import { alive, log, MOUNT, OL, seed } from "./lib.mjs"
import { layoutChecks } from "./checks.mjs"

const out = process.argv[2]
const SHOTS = path.join(out, "shots")
fs.mkdirSync(SHOTS, { recursive: true })
const SRC = path.resolve("../../src")
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const WIDTHS = [
  [390, 844],
  [820, 1100],
  [1440, 900],
]
const THEMES = ["light", "dark"]

// ---------- texts: the UI language follows the browser, so match English and Chinese ----------
const lang = (code, file) => {
  try {
    return JSON.parse(fs.readFileSync(path.join(SRC, "lang", code, `${file}.json`), "utf8"))
  } catch {
    return {}
  }
}
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
/** "home.toolbar.share" -> /Share|分享/ */
const tr = (key) => {
  const [file, ...rest] = key.split(".")
  const words = ["en", "zh-CN"]
    .map((c) => rest.reduce((o, k) => o?.[k], lang(c, file)))
    .filter((v) => typeof v === "string" && v)
  return new RegExp(words.length ? words.map(esc).join("|") : "^$")
}

// ---------- the routes, from the source ----------
const read = (f) => fs.readFileSync(path.join(SRC, f), "utf8")
const manageRoutes = () => {
  const keys = [...read("pages/manage/route-components.tsx").matchAll(/^\s*"(\/[^"]+)":/gm)].map((m) => m[1])
  const hidden = [...read("pages/manage/routes.tsx").matchAll(/to: "(\/[^"]+)"/g)].map((m) => m[1])
  return [...new Set(["/profile", ...keys, ...hidden])]
}
// top-level router entries this audit visits by hand; a new entry in App.tsx
// that is not listed here is reported as uncovered
const TOP = ["/@test", "/@login", "/@init", "/@manage/tasks/:type?", "/@manage/dashboard", "/@dashboard", "/@media", "/@plugins", "/@transfers", "/@manage/*", "/@s/*", "*"]
const MEDIA_NESTED = ["/", "/video/*", "/music/*", "/image/*", "/books/*"]
const uncovered = () => {
  const found = [...read("app/App.tsx").matchAll(/<Route\s+path=\{?\[?"([^"]+)"/g)].map((m) => m[1])
  return found.filter((p) => !TOP.includes(p) && !MEDIA_NESTED.includes(p))
}

// ---------- state ----------
const findings = []
const screens = []
const browser = await chromium.launch()
const seeded = await seed(out)
const ids = seeded.ids
const token = seeded.token

class Env {
  constructor(width, height, theme, tok) {
    Object.assign(this, { width, height, theme, tok, slots: {}, events: [] })
  }
  async page(kind) {
    if (!this.slots[kind]) this.slots[kind] = await this.open(kind)
    return this.slots[kind].page
  }
  async open(kind) {
    const ctx = await browser.newContext({
      viewport: { width: this.width, height: this.height },
      locale: "zh-CN",
      colorScheme: this.theme,
    })
    if (kind === "auth") await ctx.addInitScript((t) => localStorage.setItem("token", t), this.tok)
    const page = await ctx.newPage()
    page.setDefaultTimeout(8000)
    page.on("pageerror", (e) => this.events.push(["pageerror", String(e?.message || e).split("\n")[0].slice(0, 200)]))
    page.on("console", (m) => {
      if (m.type() === "error") this.events.push(["console-error", m.text().split("\n")[0].slice(0, 200)])
    })
    page.on("response", (r) => {
      if (r.status() >= 400) this.events.push(["http-error", `${r.status()} ${decodeURIComponent(r.url().replace(OL, "")).slice(0, 120)}`])
    })
    return { ctx, page }
  }
  async respawn(kind) {
    const s = this.slots[kind]
    this.slots[kind] = null
    if (s) await Promise.race([s.ctx.close().catch(() => {}), sleep(5000)])
  }
  async closeAll() {
    for (const k of Object.keys(this.slots)) await this.respawn(k)
  }
}

// ---------- helpers handed to every screen ----------
function helpers(env, page) {
  const phone = env.width < 640
  const hang = (label) => Object.assign(new Error(`page stopped answering after: ${label}`), { hang: true })
  const h = {
    phone,
    page,
    async act(label, fn) {
      await fn()
      if (!(await alive(page))) throw hang(label)
    },
    async settle(extra = 700) {
      await page.waitForLoadState("networkidle", { timeout: 6000 }).catch(() => {})
      await page.waitForTimeout(extra)
    },
    async go(p, extra) {
      await page.goto(OL + encodeURI(p), { waitUntil: "domcontentloaded" })
      await h.settle(extra)
    },
    item: (name) => page.locator(".viselect-item", { hasText: name }).first(),
    dialog: () => page.locator('[role="dialog"], [role="alertdialog"]').first(),
    async dialogOpen(label) {
      await h.dialog().waitFor({ state: "visible", timeout: 4000 }).catch(() => {
        throw new Error(`${label}: no dialog appeared`)
      })
      await h.settle(400)
    },
    async layout(kind) {
      await h.act("view menu", () => page.locator("[data-files-view]").click())
      await h.act("pick layout", () => page.getByRole("menuitem", { name: tr(`home.layouts.${kind}`) }).first().click())
      await h.settle(900)
    },
    /** Selects by the real input: a click with Ctrl on desktop, a long press then taps on a phone. */
    async select(names) {
      let first = true
      for (const name of [].concat(names)) {
        if (phone) {
          const box = await h.item(name).boundingBox()
          if (!box) throw new Error(`no row ${name}`)
          const x = box.x + box.width / 2
          const y = box.y + box.height / 2
          if (first) {
            await page.mouse.move(x, y)
            await page.mouse.down()
            await page.waitForTimeout(800)
            await page.mouse.up()
          } else await page.mouse.click(x, y)
        } else await h.item(name).click({ modifiers: first ? [] : ["Control"] })
        first = false
      }
      await page.waitForTimeout(500)
    },
    async newAction(name) {
      if (phone) {
        await h.act("fab", () => page.locator("[data-files-fab]").click())
        await h.act(name, () => page.locator(`[data-fab-action="${name}"]`).click())
      } else {
        await h.act("new menu", () => page.locator("[data-files-new]").click())
        await h.act(name, () => page.locator(`[role="menuitem"][data-action="${name}"]`).click())
      }
    },
    /** One of copy / move / rename / delete / share / download on the selection. */
    async selAction(name, via = "bar", target) {
      if (phone) {
        if (["copy", "move", "delete"].includes(name)) await h.act(name, () => page.locator(`[data-batch="${name}"]`).click())
        else {
          await h.act("batch more", () => page.locator('[data-batch="more"]').click())
          await h.act(name, () => page.getByRole("menuitem", { name: tr(`home.toolbar.${name}`) }).first().click())
        }
      } else if (via === "ctx") {
        await h.act("context menu", () => h.item(target).click({ button: "right" }))
        await h.act(`context ${name}`, () => page.locator(`[role="menu"] [data-action="${name}"]`).click())
      } else {
        await h.act(name, () => page.locator(`[data-selection-bar] [data-action="${name}"]`).click())
      }
    },
    async moreAction(key) {
      await h.act("more menu", () => page.locator("[data-files-more]").click())
      await h.act(key, () => page.getByRole("menuitem", { name: tr(`home.toolbar.${key}`) }).first().click())
    },
    key: (k) => page.keyboard.press(k),
  }
  return h
}

// ---------- screens ----------
const DEEP = Array.from({ length: 8 }, (_, i) => `第${i + 1}层-这是一个很长很长的目录名称用来测试左侧目录树的横向滚动-level${i + 1}`)
const deepPath = (n) => `${MOUNT}/深层/${DEEP.slice(0, n).join("/")}`
const S = []
const scr = (id, run, opts = {}) => S.push({ id, run, ...opts })
const at = (id, url, extra, opts) =>
  scr(
    id,
    async (h) => {
      await h.go(url, opts?.wait)
      if (extra) await extra(h)
    },
    opts,
  )

// -- routes of the shell
at("login", "/@login", null, { guest: true })
at("init", "/@init", null, { guest: true })
at("not-found", "/@no-such-page")
at("test-page", "/@test")
at("dashboard", "/@dashboard", null, { wait: 2000 })
at("media-index", "/@media")
for (const k of ["video", "music", "image", "books"]) at(`media-${k}`, `/@media/${k}`)
at("plugins", "/@plugins")
at("transfers", "/@transfers", null, { wait: 1500 })
scr("transfers-new-sync", async (h) => {
  await h.go("/@transfers")
  await h.act("new sync", () => h.page.getByRole("button", { name: tr("transfers.sync.new_job") }).first().click())
  await h.dialogOpen("new sync")
})
at("storages-root", "/")
at("manage-home", "/@manage")
for (const sub of manageRoutes()) {
  if (/^\/plugins\/(add|config)/.test(sub)) continue // only mounted on the ts-worker backend
  const url = sub
    .replace("/storages/edit/:id", `/storages/edit/${ids.storage?.[0] ?? 1}`)
    .replace("/users/edit/:id", `/users/edit/${ids.user?.[0] ?? 1}`)
    .replace("/metas/edit/:id", `/metas/edit/${ids.meta?.[0] ?? 1}`)
    .replace("/shares/edit/:id", "/shares/edit/audit-open")
  at(`manage${url.replace(/[/:]/g, "-")}`, `/@manage${url}`, null, { wait: 1200 })
}

// -- the file browser
at("files-grid", MOUNT, (h) => h.layout("grid"))
at("files-list", MOUNT, (h) => h.layout("list"))
at("files-empty", `${MOUNT}/空目录`)
at("files-photos", `${MOUNT}/照片`, (h) => h.layout("grid"))
at("files-longnames", `${MOUNT}/长文件名`, (h) => h.layout("grid"))
at("files-longnames-list", `${MOUNT}/长文件名`, (h) => h.layout("list"))
at("files-deep", deepPath(8), null, { wait: 1500 })
scr("files-deep-tree", async (h) => {
  // the side tree opened level by level down to the deepest folder
  await h.go(deepPath(8), 1500)
  const nav = h.page.locator('[data-nav-id="files"]').first()
  await nav.scrollIntoViewIfNeeded().catch(() => {})
})
at("files-big-grid", `${MOUNT}/大目录`, (h) => h.layout("grid"))
at("files-big-list", `${MOUNT}/大目录`, (h) => h.layout("list"))
scr("files-big-scrolled", async (h) => {
  await h.go(`${MOUNT}/大目录`)
  await h.layout("list")
  await h.page.mouse.move(h.phone ? 200 : 700, 400)
  await h.page.mouse.wheel(0, 4000)
  await h.settle(900)
})
at("files-library", `${MOUNT}/媒体库`, null, { wait: 2500 })
at("files-library-list", `${MOUNT}/媒体库`, (h) => h.layout("list"), { wait: 2000 })
at("files-library-work", `${MOUNT}/媒体库/电影甲 (2020)`, null, { wait: 2000 })
at("files-library-show", `${MOUNT}/媒体库/剧集乙 (2021)`, null, { wait: 2000 })
at("files-docs", `${MOUNT}/文档`, (h) => h.layout("list"))

// selection and menus
scr("select-one", async (h) => {
  await h.go(`${MOUNT}/文档`)
  await h.select("笔记")
})
scr("select-many", async (h) => {
  await h.go(`${MOUNT}/文档`)
  await h.select(["笔记", "配置", "报告"])
})
scr("select-all-more-menu", async (h) => {
  await h.go(`${MOUNT}/文档`)
  await h.select("笔记")
  if (h.phone) await h.act("more", () => h.page.locator('[data-batch="more"]').click())
  else await h.act("more", () => h.page.locator('[data-action="batch-more"]').click())
  await h.page.waitForTimeout(500)
})
scr("menu-new", async (h) => {
  await h.go(`${MOUNT}/文档`)
  if (h.phone) await h.act("fab", () => h.page.locator("[data-files-fab]").click())
  else await h.act("new", () => h.page.locator("[data-files-new]").click())
  await h.page.waitForTimeout(500)
})
scr("menu-more", async (h) => {
  await h.go(`${MOUNT}/文档`)
  await h.act("more", () => h.page.locator("[data-files-more]").click())
  await h.page.waitForTimeout(500)
})
scr("menu-view", async (h) => {
  await h.go(`${MOUNT}/文档`)
  await h.act("view", () => h.page.locator("[data-files-view]").click())
  await h.page.waitForTimeout(500)
})
scr("menu-crumb", async (h) => {
  await h.go(`${MOUNT}/文档`)
  await h.act("crumb", () => h.page.locator(h.phone ? "[data-files-current]" : "[data-files-crumb-menu]").click())
  await h.page.waitForTimeout(500)
})
scr("menu-account", async (h) => {
  await h.go(`${MOUNT}/文档`)
  await h.act("account", () => h.page.getByRole("button", { name: tr("shell.nav.account") }).first().click())
  await h.page.waitForTimeout(500)
})
scr("palette", async (h) => {
  await h.go(`${MOUNT}/文档`)
  await h.act("ctrl+k", () => h.key("Control+k"))
  await h.page.waitForTimeout(500)
  await h.act("type", () => h.page.keyboard.type("设置"))
  await h.page.waitForTimeout(700)
})
scr("search-dialog", async (h) => {
  await h.go(`${MOUNT}/文档`)
  await h.act("ctrl+shift+k", () => h.key("Control+Shift+k"))
  await h.dialogOpen("search")
  await h.act("type", () => h.page.keyboard.type("笔记"))
  await h.page.keyboard.press("Enter")
  await h.settle(1500)
})
scr("task-center", async (h) => {
  await h.go(`${MOUNT}/文档`)
  await h.act("tasks", () => h.page.getByRole("button", { name: tr("shell.task_center.title") }).first().click())
  await h.page.waitForTimeout(600)
})
scr("error-center", async (h) => {
  await h.go(`${MOUNT}/文档`)
  await h.act("errors", () => h.page.locator("[data-error-center-trigger]").first().click())
  await h.page.waitForTimeout(600)
})
scr("phone-path-sheet", async (h) => {
  await h.go(deepPath(3))
  await h.act("path", () => h.page.locator("[data-files-current]").click())
  await h.page.waitForTimeout(600)
}, { only: "phone" })
scr("phone-me-sheet", async (h) => {
  await h.go(`${MOUNT}/文档`)
  await h.act("me", () => h.page.getByRole("button", { name: /^(Me|我的?)$/ }).click())
  await h.page.waitForTimeout(600)
}, { only: "phone" })
scr("ctx-file", async (h) => {
  await h.go(`${MOUNT}/文档`)
  await h.layout("list")
  await h.act("ctx", () => h.item("笔记").click({ button: "right" }))
  await h.page.waitForTimeout(500)
}, { only: "wide" })
scr("ctx-file-more", async (h) => {
  await h.go(`${MOUNT}/文档`)
  await h.layout("list")
  await h.act("ctx", () => h.item("压缩包").click({ button: "right" }))
  await h.act("more", () => h.page.getByRole("menuitem", { name: tr("files.more_actions") }).first().hover())
  await h.page.waitForTimeout(500)
}, { only: "wide" })
scr("ctx-folder", async (h) => {
  await h.go(MOUNT)
  await h.act("ctx", () => h.item("文档").click({ button: "right" }))
  await h.page.waitForTimeout(500)
}, { only: "wide" })
scr("ctx-multi", async (h) => {
  await h.go(`${MOUNT}/文档`)
  await h.select(["笔记", "配置"])
  await h.act("ctx", () => h.item("配置").click({ button: "right" }))
  await h.page.waitForTimeout(500)
}, { only: "wide" })

// dialogs: opened from the real controls, closed by loading the next screen
for (const name of ["mkdir", "new_file", "offline_download"]) {
  scr(`dialog-${name}`, async (h) => {
    await h.go(`${MOUNT}/文档`)
    await h.newAction(name)
    await h.dialogOpen(name)
  })
}
scr("dialog-upload", async (h) => {
  await h.go(`${MOUNT}/文档`)
  const chooser = h.page.waitForEvent("filechooser", { timeout: 4000 }).catch(() => null)
  await h.newAction("upload")
  const c = await chooser
  if (c) await c.setFiles([]).catch(() => {})
  await h.settle(600)
})
for (const key of ["recursive_move", "remove_empty_directory", "batch_rename", "local_settings"]) {
  scr(`dialog-${key}`, async (h) => {
    await h.go(`${MOUNT}/文档`)
    await h.moreAction(key)
    await h.dialogOpen(key)
  }, { only: "wide" })
}
scr("dialog-media-editor", async (h) => {
  await h.go(`${MOUNT}/媒体库`, 1500)
  await h.act("more", () => h.page.locator("[data-files-more]").click())
  await h.act("media", () => h.page.locator("[data-media-info]").click())
  await h.settle(1200)
}, { only: "wide" })
for (const name of ["rename", "copy", "move", "delete", "share"]) {
  scr(`dialog-${name}`, async (h) => {
    await h.go(`${MOUNT}/文档`)
    await h.select("笔记")
    await h.selAction(name)
    await h.dialogOpen(name)
  })
  // the same from the right-click menu; the share of a folder is the reported freeze
  scr(`dialog-${name}-from-context`, async (h) => {
    await h.go(MOUNT)
    await h.selAction(name, "ctx", "文档")
    await h.dialogOpen(name)
  }, { only: "wide" })
}
scr("dialog-decompress", async (h) => {
  await h.go(`${MOUNT}/文档`)
  await h.select("压缩包")
  if (h.phone) await h.selAction("decompress")
  else {
    await h.act("batch more", () => h.page.locator('[data-action="batch-more"]').click())
    await h.act("decompress", () => h.page.getByRole("menuitem", { name: tr("home.toolbar.decompress") }).first().click())
  }
  await h.dialogOpen("decompress")
})
scr("dialog-package-download", async (h) => {
  await h.go(MOUNT)
  await h.select("文档")
  if (h.phone) {
    await h.act("batch more", () => h.page.locator('[data-batch="more"]').click())
    await h.act("download", () => h.page.getByRole("menuitem", { name: tr("home.toolbar.package_download") }).first().click())
  } else await h.selAction("download")
  await h.dialogOpen("package download")
})

// previews, one per type
for (const [id, file, wait] of [
  ["video", "示例视频.mp4", 5000],
  ["audio", "示例音乐.mp3", 2500],
  ["image", "图片.jpg", 2000],
  ["text", "文本.txt", 1500],
  ["markdown", "说明.md", 1500],
  ["pdf", "报告.pdf", 4000],
  ["archive", "压缩包.zip", 2500],
  ["json", "配置.json", 1500],
]) {
  at(`preview-${id}`, `${MOUNT}/预览/${file}`, null, { wait })
}

// share-link pages: a guest opens them
at("share-open", "/@s/audit-open", null, { guest: true, wait: 1500 })
at("share-password-prompt", "/@s/audit-pwd", null, { guest: true, wait: 1500 })
scr("share-password-wrong", async (h) => {
  await h.go("/@s/audit-pwd", 1000)
  await h.act("fill", () => h.page.locator("input").first().fill("wrong-password"))
  await h.page.keyboard.press("Enter")
  await h.settle(1000)
}, { guest: true })
scr("share-password-ok", async (h) => {
  await h.go("/@s/audit-pwd", 1000)
  await h.act("fill", () => h.page.locator("input").first().fill("audit1234"))
  await h.page.keyboard.press("Enter")
  await h.settle(1500)
}, { guest: true })
at("share-as-admin", "/@s/audit-open", null, { wait: 1500 })

// ---------- run ----------
function rel(p) {
  return path.relative(out, p).replace(/\\/g, "/")
}
async function runScreen(env, s) {
  const phone = env.width < 640
  if (s.only === "phone" && !phone) return
  if (s.only === "wide" && phone) return
  const kind = s.guest ? "guest" : "auth"
  const base = { page: s.id, width: env.width, theme: env.theme }
  const page = await env.page(kind)
  env.events = []
  let hung = ""
  let failed = ""
  try {
    await s.run(helpers(env, page))
  } catch (e) {
    if (e.hang) hung = e.message
    else failed = String(e?.message || e).split("\n")[0].slice(0, 240)
  }
  if (!hung && !(await alive(page))) hung = "page stopped answering after the screen was set up"
  if (hung) {
    findings.push({ ...base, type: "hang", detail: hung, el: "", screenshot: "" })
    screens.push({ ...base, shot: "", ok: false, counts: {} })
    await env.respawn(kind)
    return
  }
  const file = path.join(SHOTS, `${s.id}.${env.width}.${env.theme}.png`)
  let shot = ""
  try {
    await page.screenshot({ path: file, timeout: 10000 })
    shot = rel(file)
  } catch {}
  const res = await Promise.race([page.evaluate(layoutChecks).catch(() => null), sleep(10000).then(() => null)])
  if (failed) findings.push({ ...base, type: "step-failed", detail: failed, el: "", screenshot: shot })
  if (!res) findings.push({ ...base, type: "checks-failed", detail: "layout checks did not return", el: "", screenshot: shot })
  for (const f of res?.findings ?? []) findings.push({ ...base, ...f, count: res.counts[f.type], screenshot: shot })
  const seen = new Set()
  for (const [type, detail] of env.events) {
    if (seen.has(type + detail)) continue
    seen.add(type + detail)
    findings.push({ ...base, type, detail, el: "", screenshot: shot })
  }
  screens.push({ ...base, shot, ok: !failed, counts: res?.counts ?? {} })
  log(`${s.id} ${env.width} ${env.theme}`, failed ? `FAILED ${failed}` : "ok", JSON.stringify(res?.counts ?? {}))
}

await Promise.all(
  WIDTHS.map(async ([w, hgt]) => {
    for (const theme of THEMES) {
      const env = new Env(w, hgt, theme, token)
      for (const s of S) await runScreen(env, s)
      await env.closeAll()
    }
  }),
)
await browser.close()

for (const p of uncovered()) findings.push({ page: "router", width: 0, theme: "", type: "uncovered-route", detail: p, el: "", screenshot: "" })

// ---------- report ----------
fs.writeFileSync(path.join(out, "audit.json"), JSON.stringify({ screens, findings }, null, 1))
const byPage = new Map()
for (const f of findings) {
  const m = byPage.get(f.page) ?? new Map()
  m.set(f.type, (m.get(f.type) ?? 0) + 1)
  byPage.set(f.page, m)
}
const rows = new Map()
for (const f of findings) {
  const k = [f.page, f.width, f.theme, f.type].join("|")
  const r = rows.get(k) ?? { ...f, n: 0 }
  r.n += 1
  rows.set(k, r)
}
const top = new Map()
for (const f of findings) {
  const k = `${f.type} ${f.el.replace(/ "[^"]*" @.*$/, "") || f.detail.slice(0, 60)}`
  const r = top.get(k) ?? { n: 0, pages: new Set(), sample: f }
  r.n += 1
  r.pages.add(f.page)
  top.set(k, r)
}
const cell = (s) => String(s ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ")
let md = `# UI audit\n\n${screens.length} screen runs, ${findings.length} findings.\n\n`
md += "## Counts per page\n\n| page | findings | by type |\n|---|---|---|\n"
for (const [p, m] of [...byPage].sort((a, b) => b[1].size - a[1].size)) {
  const types = [...m].map(([t, n]) => `${t}:${n}`).join(" ")
  const total = findings.filter((f) => f.page === p).length
  md += `| ${p} | ${total} | ${types} |\n`
}
md += "\n## Most repeated findings\n\n| finding | count | pages | example | screenshot |\n|---|---|---|---|---|\n"
for (const [k, r] of [...top].sort((a, b) => b[1].n - a[1].n).slice(0, 60)) {
  md += `| ${cell(k)} | ${r.n} | ${r.pages.size} | ${cell(r.sample.detail)} | ${r.sample.screenshot} |\n`
}
md += "\n## Hangs, failed steps and errors\n\n| page | width | theme | type | detail | screenshot |\n|---|---|---|---|---|---|\n"
for (const f of findings.filter((f) => ["hang", "step-failed", "pageerror", "console-error", "http-error", "uncovered-route", "checks-failed"].includes(f.type))) {
  md += `| ${f.page} | ${f.width} | ${f.theme} | ${f.type} | ${cell(f.detail)} | ${f.screenshot} |\n`
}
md += "\n## Layout findings (page x width x theme x finding)\n\n| page | width | theme | finding | n | example | screenshot |\n|---|---|---|---|---|---|---|\n"
for (const r of [...rows.values()].filter((r) => r.el || r.type === "page-hscroll")) {
  md += `| ${r.page} | ${r.width} | ${r.theme} | ${r.type} | ${r.count ?? r.n} | ${cell(r.el)} ${cell(r.detail)} | ${r.screenshot} |\n`
}
fs.writeFileSync(path.join(out, "audit.md"), md)
log("done", `${screens.length} screens, ${findings.length} findings`)
