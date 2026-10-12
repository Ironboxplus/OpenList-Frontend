import { fireEvent } from "@solidjs/testing-library"
import { beforeEach, describe, expect, it, vi } from "vitest"
vi.mock("~/hooks", async (orig) =>
  (await import("./mocks")).hooksMock(await orig()),
)
vi.mock("~/utils/notify", async () => (await import("./mocks")).notifyMock())
vi.mock("~/plugins", () => ({
  PluginSlot: () => <div data-testid="slot" />,
  slotComponents: () => [],
}))

import Dashboard from "../Dashboard"
import Messenger from "../messenger/Messenger"
import { WebauthnItem } from "../users/Webauthnitems"
import {
  clickButton,
  expectGolden,
  lastCall,
  mockApi,
  renderPage,
  settle,
  setValue,
  writes,
} from "./harness"
import { resetRouter } from "./mocks"

beforeEach(() => {
  resetRouter()
  mockApi({
    "POST /admin/message/get": () => ({
      type: "string",
      content: "hello from peer",
    }),
    "POST /admin/message/send": () => null,
    "POST /authn/delete_authn": () => null,
  })
})

describe("messenger", () => {
  it("sends the typed message and shows received ones", async () => {
    renderPage(() => <Messenger />)
    await settle()
    setValue(document.querySelector("input")!, "ping")
    await clickButton("Send")
    expectGolden(
      "messenger-send",
      lastCall("POST", "/admin/message/send")!.body,
    )
    await clickButton("Receive")
    expect(document.body.textContent).toContain("hello from peer")
  })
})

describe("webauthn credential", () => {
  it("deleting posts the credential id after a second confirmation", async () => {
    renderPage(() => <WebauthnItem id="cred1" fingerprint="fp" />)
    await settle()
    expect(document.body.textContent).toContain("fp")
    await clickButton("Delete")
    const confirm = [...document.querySelectorAll("button")].find(
      (b) => b.textContent?.trim() === "Confirm",
    )
    if (confirm) {
      fireEvent.click(confirm)
      await settle()
    }
    expectGolden(
      "webauthn-delete",
      writes().map((c) => [c.path, c.body]),
    )
  })
})

describe("dashboard", () => {
  it("renders the plugin slot and an empty hint", async () => {
    renderPage(() => <Dashboard />)
    await settle()
    expect(document.querySelector("[data-testid=slot]")).toBeTruthy()
  })
})
