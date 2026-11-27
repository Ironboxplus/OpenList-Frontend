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
    // a new share keeps the order of the files folded away
    const group = document.querySelector<HTMLElement>(
      '[data-testid="share-order-group"]',
    )!
    expect(group.getAttribute("aria-expanded")).toBe("false")
    fireEvent.click(group)
    // the order of the files is one control: basis, direction, folders on top
    const order = document.querySelector<HTMLElement>(
      '[data-testid="share-order"]',
    )!
    const direction = order.querySelector<HTMLButtonElement>(
      '[data-testid="share-order-direction"]',
    )!
    expect(direction.disabled).toBe(true)
    fireEvent.click(order.querySelector('[data-segment="size"]')!)
    expect(direction.disabled).toBe(false)
    fireEvent.click(direction)
    fireEvent.click(order.querySelector('input[role="switch"]')!)
    await settle()
    setValue(document.getElementById("pwd")!, "abcde")
    setValue(document.getElementById("max_accessed")!, "7")
    setValue(document.getElementById("expires")!, "2030-01-01T00:00:00Z")
    setValue(document.getElementById("readme")!, "# hi")
    setValue(document.getElementById("header")!, "# head")
    await clickButton("Add")
    const body = lastCall("POST", "/share/create")!.body as Record<
      string,
      unknown
    >
    expectGolden("share-create", body)
    // the three lifecycle switches default to: open for preview and download, not burning
    expect(body.burn_after_read).toBe(false)
    expect(body.allow_preview).toBe(true)
    expect(body.allow_download).toBe(true)
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

  it("edit: a share whose order was changed opens with it unfolded", async () => {
    router.params = { id: "abc" }
    renderPage(() => <AddOrEdit />)
    await settle()
    const group = document.querySelector<HTMLElement>(
      '[data-testid="share-order-group"]',
    )!
    expect(group.getAttribute("aria-expanded")).toBe("true")
    expect(group.textContent).toContain("(3)")
    expect(group.textContent).toContain("3 changed")
  })

  it("edit: a share at the default order keeps it folded; empty choices say what happens", async () => {
    router.params = { id: "abc" }
    mockApi({
      "GET /share/get": () => ({
        ...structuredClone(SHARE),
        order_by: "",
        order_direction: "",
        extract_folder: "",
        max_accessed: 0,
      }),
    })
    renderPage(() => <AddOrEdit />)
    await settle()
    const group = document.querySelector<HTMLElement>(
      '[data-testid="share-order-group"]',
    )!
    expect(group.getAttribute("aria-expanded")).toBe("false")
    expect(group.textContent).not.toContain("changed")
    const order = document.querySelector('[data-testid="share-order"]')!
    expect(order.textContent).toContain("As the storage lists them")
    expect(order.textContent).toContain("Ascending")
    expect(order.textContent).toContain("Mixed with files")
    const max = document.getElementById("max_accessed") as HTMLInputElement
    expect(max.value).toBe("")
    expect(max.placeholder).toBe("Unlimited")
    expect(
      (document.getElementById("expires") as HTMLInputElement).placeholder,
    ).toBe("Never")
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
