// Shared by audit.mjs and bugs.mjs: talks to the real OpenList container of
// .github/workflows/ui-compare.yml and seeds it with what the screens need.
// Every seeding step is best effort and logged: a step that fails leaves a
// screen without data, it does not stop the run.
import fs from "node:fs"
import path from "node:path"

export const OL = "http://127.0.0.1:5244"
export const MOUNT = "/审计"

export const log = (...a) => console.log("[ui]", ...a)

export async function step(name, fn) {
  try {
    const v = await fn()
    log("ok", name)
    return v
  } catch (e) {
    log("FAILED", name, String(e?.message || e).split("\n")[0])
  }
}

async function call(method, p, body, token) {
  const r = await fetch(OL + p, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const j = await r.json()
  if (j.code !== 200) throw new Error(`${p}: ${j.code} ${j.message}`)
  return j.data
}
export const olPost = (p, body, token) => call("POST", p, body ?? {}, token)
export const olGet = (p, token) => call("GET", p, undefined, token)

export async function adminToken() {
  // A fresh server has no admin yet: the first-run setup creates it. When the
  // compare step ran first, the setup is done and only the login is needed.
  try {
    await olPost("/api/public/init/setup", {
      username: "admin",
      password: process.env.OL_PASS,
      site_title: "OpenList",
    })
  } catch {}
  return (await olPost("/api/auth/login", { username: "admin", password: process.env.OL_PASS })).token
}

const setSetting = async (token, key, value) => {
  const item = await olGet(`/api/admin/setting/get?key=${key}`, token)
  await olPost("/api/admin/setting/save", [{ ...item, value }], token)
}

const addStorage = async (token, mount, root) => {
  const list = await olGet("/api/admin/storage/list", token)
  if ((list.content ?? []).some((s) => s.mount_path === mount)) return
  await olPost(
    "/api/admin/storage/create",
    {
      mount_path: mount,
      driver: "Local",
      order: 0,
      cache_expiration: 0,
      webdav_policy: "native_proxy",
      addition: JSON.stringify({ root_folder_path: root, thumbnail: true, show_hidden: true }),
    },
    token,
  )
}

/** Share bodies are the ones the Share dialog posts. */
const createShare = (token, files, pwd) =>
  olPost(
    "/api/share/create",
    {
      files,
      pwd,
      expires: null,
      max_accessed: 0,
      burn_after_read: false,
      order_by: "",
      order_direction: "",
      extract_folder: "",
      remark: "ui audit",
      readme: "",
      header: "",
    },
    token,
  )

/**
 * Brings the instance to the state the audit and the bug specs expect and
 * returns the ids they need. `dir` receives seed.json.
 */
export async function seed(dir) {
  const out = { shares: {}, ids: {} }
  const token = await adminToken()
  out.token = token
  await step("storages", async () => {
    await addStorage(token, "/示例", "/samples")
    await addStorage(token, MOUNT, "/samples-audit")
  })
  await step("settings", async () => {
    for (const [key, value] of [
      ["hide_files", ""],
      ["announcement", ""],
      ["hide_storage_details", "false"],
      ["search_index", "database"],
      ["media_enabled", "true"],
    ]) {
      await step(`setting ${key}`, () => setSetting(token, key, value))
    }
  })
  await step("media libraries", async () => {
    for (const media_type of ["video", "music", "image", "book"]) {
      await step(`media config ${media_type}`, () =>
        olPost("/api/admin/media/config/save", { media_type, enabled: true }, token),
      )
    }
    // path_merge makes the folders under the library its works, as markLibrary does
    await olPost(
      "/api/admin/media/scan_paths/create",
      { media_type: "video", name: "媒体库", path: `${MOUNT}/媒体库`, path_merge: true, enable_scrape: false },
      token,
    )
    await olPost("/api/admin/media/scan/start", { media_type: "video" }, token)
  })
  await step("shares", async () => {
    // a custom id needs a permission the admin lacks: the server picks the ids
    const open = await createShare(token, [`${MOUNT}/文档`], "")
    const pwd = await createShare(token, [`${MOUNT}/文档`], "audit1234")
    out.shares = { open: open.id, pwdId: pwd.id, pwd: "audit1234" }
  })
  await step("guest enabled", async () => {
    const users = await olGet("/api/admin/user/list", token)
    const guest = (users.content ?? []).find((u) => u.username === "guest")
    if (guest) await olPost("/api/admin/user/update", { ...guest, disabled: false }, token)
  })
  await step("meta", async () => {
    await olPost("/api/admin/meta/create", { path: `${MOUNT}/文档`, password: "", p_sub: false, write: false, w_sub: false, hide: "", h_sub: false, readme: "", r_sub: false, header: "", header_sub: false }, token)
  })
  await step("ids", async () => {
    const lists = {
      storage: "/api/admin/storage/list",
      user: "/api/admin/user/list",
      meta: "/api/admin/meta/list",
    }
    for (const [k, p] of Object.entries(lists)) {
      const l = await olGet(p, token)
      out.ids[k] = (l.content ?? []).map((x) => x.id)
    }
  })
  await step("index build", async () => {
    await olPost("/api/admin/index/build", { paths: ["/"], max_depth: -1 }, token)
  })
  if (dir) {
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, "seed.json"), JSON.stringify({ ...out, token: undefined }, null, 1))
  }
  return out
}

/** Round trip of the page: a hung renderer does not answer within `ms`. */
export const alive = (page, ms = 2000) =>
  Promise.race([
    page.evaluate(() => 1).then(
      () => true,
      () => false,
    ),
    new Promise((r) => setTimeout(() => r(false), ms)),
  ])
