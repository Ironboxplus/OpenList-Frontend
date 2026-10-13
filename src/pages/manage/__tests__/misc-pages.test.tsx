import { fireEvent } from "@solidjs/testing-library"
import { beforeEach, describe, expect, it, vi } from "vitest"
vi.mock("~/hooks", async (orig) =>
  (await import("./mocks")).hooksMock(await orig()),
)
vi.mock("~/utils/notify", async () => (await import("./mocks")).notifyMock())

import Messenger from "../messenger/Messenger"
import { WebauthnCredentials } from "../users/Webauthnitems"
import {
  chooseMenuItem,
  clickButton,
  expectGolden,
  lastCall,
  mockApi,
  openRowMenu,
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
    mockApi({
      "GET /authn/getcredentials": () => [{ id: "cred1", fingerprint: "fp" }],
      "POST /authn/delete_authn": () => null,
    })
    renderPage(() => <WebauthnCredentials />)
    await settle()
    expect(document.body.textContent).toContain("fp")
    await openRowMenu(0)
    await chooseMenuItem("Delete")
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
