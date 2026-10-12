import { fireEvent, screen } from "@solidjs/testing-library"
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
  expectGolden,
  failure,
  lastCall,
  mockApi,
  renderPage,
  settle,
  setValue,
} from "./harness"
import { resetRouter, router } from "./mocks"

beforeEach(() => {
  resetRouter()
  mockApi({
    "GET /admin/driver/list": () => structuredClone(DRIVERS),
    "GET /admin/storage/get": () => structuredClone(STORAGE),
    "GET /admin/driver/info": (c) =>
      structuredClone((DRIVERS as any)[c.query.driver]),
    "POST /admin/storage/create": () => ({ id: 9 }),
    "POST /admin/storage/update": () => null,
  })
})

describe("storage editor payloads", () => {
  it("add: choosing a driver fills defaults, switching clears addition", async () => {
    renderPage(() => <AddOrEdit />)
    await settle()
    await chooseDriver("Local")
    setValue(document.getElementById("mount_path")!, "/mnt")
    setValue(document.getElementById("root_folder_path")!, "/srv")
    // switch away and back: addition must be cleared to defaults, not merged
    await chooseDriver("Aliyundrive")
    expect(await screen.findByText(/infinite loop/)).toBeTruthy()
    await chooseDriver("Local")
    setValue(document.getElementById("root_folder_path")!, "/srv2")
    setValue(document.getElementById("order")!, "5")
    fireEvent.click(document.getElementById("web_proxy")!)
    await clickButton("Add")
    await settle()
    expectGolden(
      "storage-create",
      lastCall("POST", "/admin/storage/create")!.body,
    )
    expect(router.to).toHaveBeenCalledWith("/@manage/storages", false, {
      replace: true,
    })
  })

  it("add: a driver that fails to start but was created sends you to its edit page", async () => {
    mockApi({
      "GET /admin/driver/list": () => structuredClone(DRIVERS),
      "POST /admin/storage/create": () =>
        failure(500, "init failed", { id: 9 }),
    })
    renderPage(() => <AddOrEdit />)
    await settle()
    await chooseDriver("Local")
    await clickButton("Add")
    expect(router.to).toHaveBeenCalledWith("/@manage/storages/edit/9")
  })

  it("edit: loads storage and driver info, saves, then returns to the list", async () => {
    router.params = { id: "7" }
    renderPage(() => <AddOrEdit />)
    await settle()
    setValue(document.getElementById("remark")!, "changed")
    setValue(document.getElementById("chunk")!, "16")
    setValue(document.getElementById("ratio")!, "0.25")
    fireEvent.click(document.getElementById("thumbnail")!)
    await clickButton("Save")
    await settle()
    expectGolden(
      "storage-update",
      lastCall("POST", "/admin/storage/update")!.body,
    )
    expect(router.to).toHaveBeenCalledWith("/@manage/storages", false, {
      replace: true,
    })
  })

  it("import: pasted JSON replaces the form (id/status/modified dropped) and saves as a new storage", async () => {
    renderPage(() => <AddOrEdit />)
    await settle()
    await chooseDriver("Local")
    await clickButton("Import")
    const { id, disabled, modified, status, ...rest } = STORAGE
    const box = document.getElementById("modal-input") as HTMLTextAreaElement
    setValue(box, JSON.stringify({ ...rest, mount_path: "/imported" }))
    await clickButton("OK")
    await clickButton("Add")
    expectGolden(
      "storage-import-create",
      lastCall("POST", "/admin/storage/create")!.body,
    )
  })
})

const chooseDriver = (name: string) =>
  chooseOption("driver", new RegExp(name, "i"))
