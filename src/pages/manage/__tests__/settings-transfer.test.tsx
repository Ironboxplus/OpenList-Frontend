import { fireEvent } from "@solidjs/testing-library"
import { beforeEach, describe, expect, it, vi } from "vitest"
vi.mock("~/hooks", async (orig) =>
  (await import("./mocks")).hooksMock(await orig()),
)
vi.mock("~/utils/notify", async () => (await import("./mocks")).notifyMock())

import { Flag, Group, Type } from "~/types"
import Transfer from "../settings/Transfer"
import { COMMON_ITEMS } from "./fixtures"
import {
  clickButton,
  lastCall,
  mockApi,
  renderPage,
  settle,
  setValue,
} from "./harness"
import { resetRouter, router } from "./mocks"

const row = (key: string, value: string) => ({
  key,
  value,
  type: Type.Number,
  help: "",
  options: "",
  group: Group.TRAFFIC,
  flag: Flag.PRIVATE,
})
// OP internal/bootstrap/data/setting.go:310-320, the Traffic group
const DEFAULTS = [
  row("offline_download_task_threads_num", "5"),
  row("offline_download_transfer_task_threads_num", "5"),
  row("upload_task_threads_num", "5"),
  row("copy_task_threads_num", "5"),
  row("move_task_threads_num", "5"),
  row("decompress_download_task_threads_num", "5"),
  row("decompress_upload_task_threads_num", "5"),
  row("max_client_download_speed", "-1"),
  row("max_client_upload_speed", "-1"),
  row("max_server_download_speed", "-1"),
  row("max_server_upload_speed", "-1"),
]
const conns = {
  name: "max_conns_per_file",
  type: Type.Number,
  default: "2",
  help: "x",
}
const DRIVERS = {
  Local: { common: COMMON_ITEMS, additional: [], config: { name: "Local" } },
  "115 Cloud": {
    common: COMMON_ITEMS,
    additional: [{ name: "cookie", type: Type.Text, default: "" }, conns],
    config: { name: "115 Cloud" },
  },
}
const storage = (id: number, driver: string, mount: string, add: object) => ({
  id,
  driver,
  mount_path: mount,
  addition: JSON.stringify(add),
  status: "work",
  disabled: false,
})

let settings = structuredClone(DEFAULTS)
let bw = -1

beforeEach(() => {
  resetRouter()
  settings = structuredClone(DEFAULTS)
  bw = -1
  mockApi({
    "GET /admin/setting/list": () => structuredClone(settings),
    "POST /admin/setting/default": () => structuredClone(DEFAULTS),
    "POST /admin/setting/save": () => null,
    "GET /public/settings": () => ({}),
    "GET /admin/sync/bwlimit": () => ({ bytes_per_second: bw }),
    "POST /admin/sync/bwlimit": (c) => {
      bw = (c.body as { rate: string }).rate === "10M" ? 10485760 : -1
      return { bytes_per_second: bw }
    },
    "GET /admin/driver/list": () => structuredClone(DRIVERS),
    "GET /admin/storage/list": () => ({
      content: [
        storage(1, "Local", "/local", {}),
        storage(2, "115 Cloud", "/115", { cookie: "c", max_conns_per_file: 3 }),
        storage(3, "115 Cloud", "/115b", { cookie: "c" }),
      ],
      total: 3,
    }),
  })
})

const card = (id: string) =>
  document.querySelector(`[data-card="${id}"]`) as HTMLElement | null
const field = (key: string) =>
  document.querySelector(`[data-field="${key}"]`) as HTMLElement | null

describe("transfer settings", () => {
  it("holds task threads, speed limits, sync bandwidth and connections per file, each saying what it governs", async () => {
    renderPage(() => <Transfer />)
    await settle()
    expect(lastCall("GET", "/admin/setting/list")?.query).toEqual({
      group: String(Group.TRAFFIC),
    })
    for (const id of [
      "task-threads",
      "speed-limits",
      "sync-bandwidth",
      "connections",
    ]) {
      expect(card(id), id).toBeTruthy()
      const scope = card(id)!.querySelector("[data-scope]")
      expect(scope?.textContent?.trim(), `${id} scope`).toBeTruthy()
    }
    // every limit says what traffic it holds back
    for (const key of [
      "max_client_download_speed",
      "max_client_upload_speed",
      "max_server_download_speed",
      "max_server_upload_speed",
    ])
      expect(
        field(key)?.querySelector("[data-help]")?.textContent?.trim(),
        key,
      ).toBeTruthy()
  })

  it("shows the common thread counts, and folds the rest under Advanced", async () => {
    renderPage(() => <Transfer />)
    await settle()
    const threads = card("task-threads")!
    for (const key of [
      "copy_task_threads_num",
      "upload_task_threads_num",
      "offline_download_task_threads_num",
    ])
      expect(field(key)?.closest("[hidden]"), key).toBeNull()
    const trigger = threads.querySelector(
      "[data-testid=advanced-task-threads]",
    ) as HTMLElement
    expect(trigger.getAttribute("aria-expanded")).toBe("false")
    expect(trigger.textContent).toMatch(/4/)
    expect(field("move_task_threads_num")?.closest("[hidden]")).toBeTruthy()
  })

  it("marks and opens Advanced when a folded count is not the default", async () => {
    settings = settings.map((s) =>
      s.key === "move_task_threads_num" ? { ...s, value: "9" } : s,
    )
    renderPage(() => <Transfer />)
    await settle()
    const trigger = card("task-threads")!.querySelector(
      "[data-testid=advanced-task-threads]",
    ) as HTMLElement
    expect(trigger.getAttribute("aria-expanded")).toBe("true")
    expect(trigger.querySelector("[data-testid=changed-mark]")).toBeTruthy()
  })

  it("opens the group of a setting it is sent to", async () => {
    router.searchParams = { focus: "decompress_upload_task_threads_num" }
    renderPage(() => <Transfer />)
    await settle()
    const trigger = card("task-threads")!.querySelector(
      "[data-testid=advanced-task-threads]",
    ) as HTMLElement
    expect(trigger.getAttribute("aria-expanded")).toBe("true")
    expect(
      field("decompress_upload_task_threads_num")?.hasAttribute("data-focused"),
    ).toBe(true)
  })

  it("writes -1 as Unlimited and saves the group", async () => {
    renderPage(() => <Transfer />)
    await settle()
    const box = document.getElementById(
      "max_client_download_speed",
    ) as HTMLInputElement
    expect(box.value).toBe("")
    expect(box.placeholder).toBe("Unlimited")
    setValue(box, "2048")
    setValue(document.getElementById("copy_task_threads_num")!, "8")
    await clickButton("Save")
    await settle()
    const saved = lastCall("POST", "/admin/setting/save")!.body as {
      key: string
      value: string
    }[]
    const v = (k: string) => saved.find((s) => s.key === k)?.value
    expect(v("max_client_download_speed")).toBe("2048")
    expect(v("copy_task_threads_num")).toBe("8")
    expect(v("max_server_upload_speed")).toBe("-1")
  })

  it("sets the sync bandwidth at once", async () => {
    renderPage(() => <Transfer />)
    await settle()
    const sync = card("sync-bandwidth")!
    expect(
      sync.querySelector("[data-testid=bwlimit-current]")?.textContent,
    ).toBe("Unlimited")
    setValue(sync.querySelector("[data-testid=bwlimit-input]")!, "10M")
    fireEvent.click(sync.querySelector("[data-testid=bwlimit-apply]")!)
    await settle()
    expect(lastCall("POST", "/admin/sync/bwlimit")?.body).toEqual({
      rate: "10M",
    })
    expect(
      sync.querySelector("[data-testid=bwlimit-current]")?.textContent,
    ).toBe("10.0 MiB/s")
  })

  it("lists each storage's connections per file, read-only, linked to the storage", async () => {
    renderPage(() => <Transfer />)
    await settle()
    const rows = [
      ...card("connections")!.querySelectorAll("[data-storage]"),
    ] as HTMLElement[]
    expect(rows.map((r) => r.dataset.storage)).toEqual(["2", "3"])
    expect(rows[0].textContent).toContain("/115")
    expect(rows[0].querySelector("[data-value]")?.textContent).toBe("3")
    // not set: the driver's default, said to be one
    expect(rows[1].querySelector("[data-value]")?.textContent).toMatch(/^2\b/)
    expect(rows[1].querySelector("[data-value]")?.textContent).toMatch(
      /default/i,
    )
    expect(rows[0].querySelector("a")?.getAttribute("href")).toMatch(
      /\/@manage\/storages\/edit\/2\?focus=max_conns_per_file$/,
    )
    expect(card("connections")!.querySelector("input")).toBeNull()
  })
})
