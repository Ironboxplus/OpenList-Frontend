import { fireEvent } from "@solidjs/testing-library"
import { beforeEach, describe, expect, it, vi } from "vitest"
vi.mock("~/hooks", async (orig) =>
  (await import("./mocks")).hooksMock(await orig()),
)
vi.mock("~/utils/notify", async () => (await import("./mocks")).notifyMock())

import Storages from "../storages/Storages"
import { STORAGE } from "./fixtures"
import {
  buttonByText,
  clickButton,
  expectGolden,
  mockApi,
  renderPage,
  settle,
  writes,
} from "./harness"
import { resetRouter, router } from "./mocks"

const list = [
  { ...STORAGE, id: 1, mount_path: "/a", driver: "Local", status: "work" },
  {
    ...STORAGE,
    id: 2,
    mount_path: "/b",
    driver: "Aliyundrive",
    status: "failed to init: boom",
    disabled: true,
  },
]

beforeEach(() => {
  resetRouter()
  localStorage.clear()
  mockApi({
    "GET /admin/storage/list": () => ({
      content: structuredClone(list),
      total: 2,
    }),
    "GET /admin/driver/names": () => ["Local", "Aliyundrive"],
    "POST /admin/storage/enable": () => null,
    "POST /admin/storage/disable": () => null,
    "POST /admin/storage/delete": () => null,
    "POST /admin/storage/load_all": () => null,
  })
})

/** The nth "Delete" button shown (one per storage), then its confirm. */
const confirmDelete = async (index: number) => {
  const del = [...document.querySelectorAll("button")].filter(
    (b) => b.textContent?.trim() === "Delete",
  )
  fireEvent.click(del[index])
  await settle()
  await clickButton("Confirm")
}

describe("storage list actions", () => {
  it("shows both storages with their mount paths and full status text", async () => {
    renderPage(() => <Storages />)
    await settle()
    expect(document.body.textContent).toContain("/a")
    expect(document.body.textContent).toContain("/b")
    expect(document.body.textContent).toContain("failed to init: boom")
  })

  it("enable / disable / delete / load-all hit the same endpoints", async () => {
    renderPage(() => <Storages />)
    await settle()
    // /a is enabled -> Disable ; /b is disabled -> Enable
    fireEvent.click(buttonByText("Disable"))
    await settle()
    fireEvent.click(buttonByText("Enable"))
    await settle()
    await confirmDelete(1)
    await clickButton("Reload All")
    expectGolden(
      "storages-list-writes",
      writes().map((c) => [c.method, c.path, c.query]),
    )
  })

  it("edit and add navigate to the editor", async () => {
    renderPage(() => <Storages />)
    await settle()
    fireEvent.click(buttonByText("Add"))
    expect(router.to).toHaveBeenCalledWith("/@manage/storages/add")
    fireEvent.click(
      [...document.querySelectorAll("button")].find(
        (b) => b.textContent?.trim() === "Edit",
      )!,
    )
    expect(router.to).toHaveBeenCalledWith("/@manage/storages/edit/1")
  })
})
