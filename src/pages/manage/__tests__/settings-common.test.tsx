import { fireEvent, screen } from "@solidjs/testing-library"
import { beforeEach, describe, expect, it, vi } from "vitest"
vi.mock("~/hooks", async (orig) =>
  (await import("./mocks")).hooksMock(await orig()),
)
vi.mock("~/utils/notify", async () => (await import("./mocks")).notifyMock())

import { Flag, Group, Type } from "~/types"
import CommonSettings from "../settings/Common"
import {
  calls,
  clickButton,
  expectGolden,
  lastCall,
  mockApi,
  renderPage,
  settle,
  setValue,
  toggleField,
  writes,
} from "./harness"
import { resetRouter } from "./mocks"

const item = (key: string, type: Type, value: string, extra = {}) => ({
  key,
  value,
  type,
  help: "",
  options: "",
  group: Group.SITE,
  flag: Flag.PUBLIC,
  ...extra,
})

const SETTINGS = [
  item("site_title", Type.String, "OpenList"),
  item("announcement", Type.Text, "hi"),
  item("allow_indexed", Type.Bool, "false"),
  item("home_container", Type.Select, "max_width", {
    options: "max_width,hope_container",
  }),
  item("max_items", Type.Number, "20"),
  item("old_key", Type.String, "x", { flag: Flag.DEPRECATED }),
  item("version", Type.String, "v1", { flag: Flag.READONLY }),
]

beforeEach(() => {
  resetRouter()
  mockApi({
    "GET /admin/setting/list": () => structuredClone(SETTINGS),
    "POST /admin/setting/save": () => null,
    "GET /public/settings": () => ({}),
    "POST /admin/setting/default": () =>
      structuredClone(SETTINGS).map((s) => ({ ...s, value: "DEFAULT" })),
    "POST /admin/setting/delete": () => null,
  })
})

describe("CommonSettings payload", () => {
  it("loads the group and saves exactly the edited list", async () => {
    renderPage(() => <CommonSettings group={Group.SITE} />)
    await settle()
    expect(lastCall("GET", "/admin/setting/list")?.query).toEqual({
      group: String(Group.SITE),
    })
    setValue(document.getElementById("site_title")!, "My Site")
    setValue(document.getElementById("announcement")!, "welcome")
    setValue(document.getElementById("max_items")!, "50")
    toggleField("allow_indexed")
    await clickButton("Save")
    await settle()
    const save = lastCall("POST", "/admin/setting/save")!
    expectGolden("settings-common-save", save.body)
  })

  it("load-defaults replaces the form with the defaults and Save then posts them", async () => {
    renderPage(() => <CommonSettings group={Group.SITE} />)
    await settle()
    await clickButton("Load default settings")
    expect(lastCall("POST", "/admin/setting/default")?.query).toEqual({
      group: String(Group.SITE),
    })
    await clickButton("Save")
    expectGolden(
      "settings-common-defaults-save",
      lastCall("POST", "/admin/setting/save")!.body,
    )
  })

  it("deleting a deprecated setting posts its key and reloads", async () => {
    renderPage(() => <CommonSettings group={Group.SITE} />)
    await settle()
    fireEvent.click(
      document.querySelector("[data-field=old_key] button[aria-label=Delete]")!,
    )
    await settle()
    // new UI asks first; the old one does not.
    const confirm = [...document.querySelectorAll("button")].find(
      (b) => b.textContent?.trim() === "Confirm",
    )
    if (confirm) fireEvent.click(confirm)
    await settle()
    expectGolden(
      "settings-common-delete",
      writes().map((c) => [c.method, c.path, c.query]),
    )
  })

  it("read-only settings cannot be edited", async () => {
    renderPage(() => <CommonSettings group={Group.SITE} />)
    await settle()
    expect(
      (document.getElementById("version") as HTMLInputElement).readOnly,
    ).toBe(true)
  })
})
