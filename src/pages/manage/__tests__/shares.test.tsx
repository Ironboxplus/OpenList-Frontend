import { fireEvent } from "@solidjs/testing-library"
import { beforeEach, describe, expect, it, vi } from "vitest"
vi.mock("~/hooks", async (orig) =>
  (await import("./mocks")).hooksMock(await orig()),
)
vi.mock("~/utils/notify", async () => (await import("./mocks")).notifyMock())

import { setMe } from "~/store"
import AddOrEdit from "../shares/AddOrEdit"
import Shares from "../shares/Shares"
import { ADMIN_ME, SHARE } from "./fixtures"
import {
  buttonByText,
  chooseMenuItem,
  chooseOption,
  clickButton,
  expectGolden,
  failure,
  lastCall,
  mockApi,
  openRowMenu,
  renderPage,
  settle,
  setValue,
  writes,
} from "./harness"
import { clipboard, resetRouter, router } from "./mocks"

beforeEach(() => {
  resetRouter()
  clipboard.copy.mockClear()
  setMe(structuredClone(ADMIN_ME) as any)
  mockApi({
    "GET /share/get": () => structuredClone(SHARE),
    "GET /share/list": () => ({
      content: [
        structuredClone(SHARE),
        { ...structuredClone(SHARE), id: "off", disabled: true },
      ],
      total: 2,
    }),
    "POST /share/create": () => ({ id: "new1" }),
    "POST /share/update": () => ({ id: "abc" }),
    "POST /share/enable": () => null,
    "POST /share/disable": () => null,
    "POST /share/delete": () => null,
  })
})

describe("share editor payloads", () => {
  it("add: every field, then back to the list", async () => {
    renderPage(() => <AddOrEdit />)
    await settle()
    setValue(document.getElementById("id")!, "mine")
    setValue(document.getElementById("files")!, "/x\n/y")
    setValue(document.getElementById("remark")!, "r")
    await chooseOption("extract_folder", /bottom/i)
    await chooseOption("order_by", /size/i)
    await chooseOption("order_direction", /desc/i)
    setValue(document.getElementById("pwd")!, "abcde")
    setValue(document.getElementById("max_accessed")!, "7")
    setValue(document.getElementById("expires")!, "2030-01-01T00:00:00Z")
    setValue(document.getElementById("readme")!, "# hi")
    setValue(document.getElementById("header")!, "# head")
    await clickButton("Add")
    expectGolden("share-create", lastCall("POST", "/share/create")!.body)
    expect(router.to).toHaveBeenCalledWith("/@manage/shares", false, {
      replace: true,
    })
  })

  it("add: cannot submit without files or with an unparseable expiry", async () => {
    renderPage(() => <AddOrEdit />)
    await settle()
    expect(buttonByText("Add").disabled).toBe(true)
    setValue(document.getElementById("files")!, "/x")
    expect(buttonByText("Add").disabled).toBe(false)
    setValue(document.getElementById("expires")!, "nonsense")
    expect(buttonByText("Add").disabled).toBe(true)
    setValue(document.getElementById("expires")!, "")
    expect(buttonByText("Add").disabled).toBe(false)
  })

  it("add: a failed create that still returned an id opens that share's editor", async () => {
    mockApi({ "POST /share/create": () => failure(500, "x", { id: "half" }) })
    renderPage(() => <AddOrEdit />)
    await settle()
    setValue(document.getElementById("files")!, "/x")
    await clickButton("Add")
    expect(router.to).toHaveBeenCalledWith("/@manage/shares/edit/half")
  })

  it("edit: renaming sends new_id and keeps the loaded fields", async () => {
    router.params = { id: "abc" }
    renderPage(() => <AddOrEdit />)
    await settle()
    setValue(document.getElementById("id")!, "renamed")
    setValue(document.getElementById("accessed")!, "0")
    setValue(document.getElementById("files")!, "/only")
    await clickButton("Save")
    expectGolden("share-update", lastCall("POST", "/share/update")!.body)
    expect(router.to).toHaveBeenCalledWith("/@manage/shares", false, {
      replace: true,
    })
  })
})

const nth = (label: string, i: number) =>
  [...document.querySelectorAll("button")].filter(
    (b) => b.textContent?.trim() === label,
  )[i]

describe("share list", () => {
  it("enable / disable / delete (confirmed) hit the share endpoints", async () => {
    renderPage(() => <Shares />)
    await settle()
    await openRowMenu(0)
    await chooseMenuItem("Disable")
    await openRowMenu(1)
    await chooseMenuItem("Enable")
    await openRowMenu(1)
    await chooseMenuItem("Delete")
    await clickButton("Confirm")
    expectGolden(
      "shares-list-writes",
      writes().map((c) => [c.method, c.path, c.query]),
    )
  })

  it("copy message uses the summary template", async () => {
    renderPage(() => <Shares />)
    await settle()
    await openRowMenu(0)
    await chooseMenuItem("Copy link")
    expect(clipboard.copy).toHaveBeenCalledTimes(1)
  })

  it("edit navigates to the share editor", async () => {
    renderPage(() => <Shares />)
    await settle()
    fireEvent.click(nth("Edit", 0))
    expect(router.to).toHaveBeenCalledWith("/@manage/shares/edit/abc")
  })

  it("without the share permission, add and edit are disabled", async () => {
    setMe({ ...ADMIN_ME, role: 0, permission: 0 } as any)
    renderPage(() => <Shares />)
    await settle()
    expect(buttonByText("Add").disabled).toBe(true)
    expect(nth("Edit", 0).disabled).toBe(true)
  })
})
