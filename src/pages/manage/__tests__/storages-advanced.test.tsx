import { fireEvent } from "@solidjs/testing-library"
import { beforeEach, describe, expect, it, vi } from "vitest"
vi.mock("~/hooks", async (orig) =>
  (await import("./mocks")).hooksMock(await orig()),
)
vi.mock("~/utils/notify", async () => (await import("./mocks")).notifyMock())

import AddOrEdit from "../storages/AddOrEdit"
import { DRIVERS, STORAGE } from "./fixtures"
import {
  chooseOption,
  clickButton,
  mockApi,
  renderPage,
  settle,
  setValue,
  toggleField,
} from "./harness"
import { resetRouter, router } from "./mocks"

beforeEach(() => {
  resetRouter()
  mockApi({
    "GET /admin/driver/list": () => structuredClone(DRIVERS),
    "GET /admin/storage/get": () => structuredClone(STORAGE),
    "GET /admin/driver/info": (c) =>
      structuredClone((DRIVERS as any)[c.query.driver]),
  })
})

const field = (key: string) =>
  document.querySelector(`[data-field="${key}"]`) as HTMLElement
/** Drawn inside an Advanced group (open or not). */
const folded = (key: string) =>
  !!field(key).closest('[data-motion="collapsible"]')
const trigger = (section: string) =>
  document.querySelector(
    `[data-testid="advanced-storage-${section}"]`,
  ) as HTMLElement | null

// PLAN_FE_SYSTEM_UX_1127 P3: in each section of the storage form the required
// items and the ones not at their default are in sight, the rest folded
describe("the storage form folds the items left at their default", () => {
  it("add: only the required items are in sight", async () => {
    renderPage(() => <AddOrEdit />)
    await settle()
    await chooseOption("driver", /Local/i)
    expect(folded("mount_path")).toBe(false)
    expect(folded("root_folder_path")).toBe(false)
    for (const key of ["order", "remark", "cache_expiration", "enable_sign"])
      expect(folded(key), key).toBe(true)
    for (const key of ["thumbnail", "chunk", "recycle_bin_path"])
      expect(folded(key), key).toBe(true)
    expect(field("order").closest("[hidden]")).toBeTruthy()
    expect(trigger("common")!.textContent).toMatch(/7/)
    expect(trigger("additional")!.textContent).toMatch(/6/)
  })

  it("edit: what was set is in sight; a lone default item is not folded", async () => {
    router.params = { id: "7" }
    renderPage(() => <AddOrEdit />)
    await settle()
    // order 2 and remark "note" were set; the cache time is still 30
    for (const key of ["mount_path", "order", "remark"])
      expect(folded(key), key).toBe(false)
    for (const key of ["cache_expiration", "web_proxy", "enable_sign"])
      expect(folded(key), key).toBe(true)
    // only recycle_bin_path is at its default: under 2, shown in line
    for (const key of ["thumbnail", "show_hidden", "chunk", "recycle_bin_path"])
      expect(folded(key), key).toBe(false)
    expect(trigger("additional")).toBeNull()
  })

  it("an item changed under Advanced stays there and is counted", async () => {
    router.params = { id: "7" }
    renderPage(() => <AddOrEdit />)
    await settle()
    fireEvent.click(trigger("common")!)
    await settle()
    toggleField("enable_sign")
    await settle()
    expect(folded("enable_sign")).toBe(true)
    expect(
      trigger("common")!.querySelector("[data-testid=changed-mark]")
        ?.textContent,
    ).toMatch(/1/)
  })

  it("opens the fold of the item a link asks for, and marks it", async () => {
    // Transfer settings' connections per file links here so
    router.params = { id: "7" }
    router.searchParams = { focus: "enable_sign" }
    renderPage(() => <AddOrEdit />)
    await settle()
    expect(folded("enable_sign")).toBe(true)
    expect(trigger("common")!.getAttribute("aria-expanded")).toBe("true")
    expect(field("enable_sign").hasAttribute("data-focused")).toBe(true)
  })

  it("an imported storage shows what it sets", async () => {
    renderPage(() => <AddOrEdit />)
    await settle()
    await chooseOption("driver", /Local/i)
    expect(folded("remark")).toBe(true)
    await clickButton("Import")
    const { id, disabled, modified, status, ...rest } = STORAGE
    setValue(
      document.getElementById("json-dialog-input")!,
      JSON.stringify(rest),
    )
    await clickButton("OK")
    await settle()
    expect(folded("remark")).toBe(false)
    expect(folded("thumbnail")).toBe(false)
  })
})
