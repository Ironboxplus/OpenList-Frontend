import { fireEvent } from "@solidjs/testing-library"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
vi.mock("~/hooks", async (orig) =>
  (await import("./mocks")).hooksMock(await orig()),
)
vi.mock("~/utils/notify", async () => (await import("./mocks")).notifyMock())

import BackupRestore from "../backup-restore"
import { META, SHARE, STORAGE, USER } from "./fixtures"
import {
  calls,
  clickButton,
  expectGolden,
  mockApi,
  renderPage,
  settle,
  setValue,
  writes,
} from "./harness"
import { resetRouter } from "./mocks"

const BACKUP = {
  encrypted: "",
  settings: [
    { key: "site_title", value: "Restored", type: "string" },
    { key: "version", value: "v0", type: "string" },
    { key: "index_progress", value: "{}", type: "text" },
  ],
  users: [{ ...USER, id: 11 }],
  storages: [{ ...STORAGE, id: 12 }],
  metas: [{ ...META, id: 13 }],
  shares: [{ ...SHARE, id: "sh1" }],
}

let picker: HTMLInputElement | undefined
let downloads: { name: string; blob: Blob }[] = []

beforeEach(() => {
  resetRouter()
  picker = undefined
  downloads = []
  vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(function (
    this: HTMLInputElement,
  ) {
    if (this.type === "file") picker = this
  })
  ;(URL as any).createObjectURL = (b: Blob) => {
    downloads.push({ name: "", blob: b })
    return "blob:x"
  }
  ;(URL as any).revokeObjectURL = () => {}
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {})
  const ok = () => null
  mockApi({
    "GET /admin/setting/list": () => structuredClone(BACKUP.settings),
    "GET /admin/user/list": () => ({
      content: [{ ...USER, id: 99 }],
      total: 1,
    }),
    "GET /admin/storage/list": () => ({ content: [], total: 0 }),
    "GET /admin/meta/list": () => ({ content: [], total: 0 }),
    "GET /share/list": () => ({ content: [], total: 0 }),
    "POST /admin/setting/save": ok,
    "POST /admin/user/create": ok,
    "POST /admin/user/update": ok,
    "POST /admin/storage/create": ok,
    "POST /admin/storage/update": ok,
    "POST /admin/meta/create": ok,
    "POST /admin/meta/update": ok,
    "POST /share/create": ok,
    "POST /share/update": ok,
  })
})

afterEach(() => vi.restoreAllMocks())

const pick = async (content: unknown) => {
  const input = picker!
  const file = new File([JSON.stringify(content)], "b.json", {
    type: "application/json",
  })
  Object.defineProperty(input, "files", { value: [file] })
  ;(input.onchange as any)({ target: input })
  await settle(20)
}

describe("backup and restore", () => {
  it("restore (no override) creates everything, dropping ids and read-only settings", async () => {
    renderPage(() => <BackupRestore />)
    await settle()
    await clickButton("Restore")
    await pick(BACKUP)
    expectGolden(
      "restore-plain",
      writes().map((c) => [c.path, c.body]),
    )
  })

  it("restore with override updates items that exist and creates the rest", async () => {
    const data = {
      ...BACKUP,
      users: [{ ...USER, id: 11, username: USER.username }],
    }
    mockApi({
      "GET /admin/setting/list": () => structuredClone(BACKUP.settings),
      "GET /admin/user/list": () => ({
        content: [{ ...USER, id: 99 }],
        total: 1,
      }),
      "GET /admin/storage/list": () => ({ content: [], total: 0 }),
      "GET /admin/meta/list": () => ({ content: [], total: 0 }),
      "GET /share/list": () => ({ content: [], total: 0 }),
      "POST /admin/setting/save": () => null,
      "POST /admin/user/create": () => null,
      "POST /admin/user/update": () => null,
      "POST /admin/storage/create": () => null,
      "POST /admin/meta/create": () => null,
      "POST /share/create": () => null,
    })
    renderPage(() => <BackupRestore />)
    await settle()
    fireEvent.click(document.getElementById("restore-override")!)
    await clickButton("Restore")
    await pick(data)
    expectGolden(
      "restore-override",
      writes().map((c) => [c.path, c.body]),
    )
  })

  it("backup reads the five collections and offers a download", async () => {
    renderPage(() => <BackupRestore />)
    await settle()
    await clickButton("Backup")
    await settle(20)
    expect(
      calls
        .filter((c) => c.method === "GET")
        .map((c) => c.path)
        .sort(),
    ).toEqual(
      [
        "/admin/meta/list",
        "/admin/setting/list",
        "/admin/storage/list",
        "/admin/user/list",
        "/share/list",
      ].sort(),
    )
    expect(downloads).toHaveLength(1)
    const text = await new Promise<string>((res) => {
      const fr = new FileReader()
      fr.onload = () => res(String(fr.result))
      fr.readAsText(downloads[0].blob)
    })
    expect(Object.keys(JSON.parse(text)).sort()).toEqual(
      ["encrypted", "metas", "settings", "shares", "storages", "users"].sort(),
    )
  })
})
