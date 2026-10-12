import { fireEvent } from "@solidjs/testing-library"
import { beforeEach, describe, expect, it, vi } from "vitest"
vi.mock("~/hooks", async (orig) =>
  (await import("./mocks")).hooksMock(await orig()),
)
vi.mock("~/utils/notify", async () => (await import("./mocks")).notifyMock())

import { setMe } from "~/store"
import AddOrEdit from "../metas/AddOrEdit"
import Metas from "../metas/Metas"
import { ADMIN_ME, META, USER } from "./fixtures"
import {
  buttonByText,
  clickButton,
  expectGolden,
  lastCall,
  mockApi,
  renderPage,
  settle,
  setValue,
  writes,
} from "./harness"
import { resetRouter, router } from "./mocks"

beforeEach(() => {
  resetRouter()
  setMe(structuredClone(ADMIN_ME) as any)
  mockApi({
    "GET /admin/meta/get": () => structuredClone(META),
    "GET /admin/meta/list": () => ({
      content: [structuredClone(META)],
      total: 1,
    }),
    "GET /admin/user/list": () => ({
      content: [structuredClone(USER)],
      total: 1,
    }),
    "POST /admin/meta/create": () => null,
    "POST /admin/meta/update": () => null,
    "POST /admin/meta/delete": () => null,
  })
})

describe("meta editor payloads", () => {
  it("add: path, password, flags and per-field apply-to-subfolders", async () => {
    renderPage(() => <AddOrEdit />)
    await settle()
    setValue(document.getElementById("path")!, "/pub")
    setValue(document.getElementById("password")!, "pw")
    fireEvent.click(document.getElementById("password_sub")!)
    fireEvent.click(document.getElementById("write")!)
    fireEvent.click(document.getElementById("write_sub")!)
    setValue(document.getElementById("hide")!, "x\ny")
    setValue(document.getElementById("header")!, "# h")
    setValue(document.getElementById("readme")!, "# r")
    await clickButton("Add")
    expectGolden("meta-create", lastCall("POST", "/admin/meta/create")!.body)
    expect(router.to).toHaveBeenCalledWith("/@manage/metas", false, {
      replace: true,
    })
  })

  it("edit: loads, changes a field, saves and returns to the list", async () => {
    router.params = { id: "3" }
    renderPage(() => <AddOrEdit />)
    await settle()
    expect((document.getElementById("path") as HTMLInputElement).value).toBe(
      "/secret",
    )
    setValue(document.getElementById("password")!, "newpw")
    await clickButton("Save")
    expectGolden("meta-update", lastCall("POST", "/admin/meta/update")!.body)
    expect(router.to).toHaveBeenCalledWith("/@manage/metas", false, {
      replace: true,
    })
  })
})

describe("meta list", () => {
  it("edit navigates; delete asks first and then posts the id", async () => {
    renderPage(() => <Metas />)
    await settle()
    expect(document.body.textContent).toContain("/secret")
    fireEvent.click(buttonByText("Edit"))
    expect(router.to).toHaveBeenCalledWith("/@manage/metas/edit/3")
    fireEvent.click(buttonByText("Add"))
    expect(router.to).toHaveBeenCalledWith("/@manage/metas/add")
    fireEvent.click(buttonByText("Delete"))
    await settle()
    expect(writes()).toHaveLength(0)
    await clickButton("Confirm")
    expectGolden(
      "metas-list-writes",
      writes().map((c) => [c.method, c.path, c.query]),
    )
  })
})
