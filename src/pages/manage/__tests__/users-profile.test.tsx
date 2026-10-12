import { fireEvent } from "@solidjs/testing-library"
import { beforeEach, describe, expect, it, vi } from "vitest"
vi.mock("~/hooks", async (orig) =>
  (await import("./mocks")).hooksMock(await orig()),
)
vi.mock("~/utils/notify", async () => (await import("./mocks")).notifyMock())

import { notify } from "~/utils/notify"
import { setMe, me } from "~/store"
import Profile from "../users/Profile"
import TwoFA from "../users/2fa"
import { ADMIN_ME, KEYS } from "./fixtures"
import {
  buttonByText,
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
import { resetRouter, router } from "./mocks"

beforeEach(() => {
  resetRouter()
  vi.mocked(notify.warning).mockClear()
  setMe(structuredClone(ADMIN_ME) as any)
  mockApi({
    "POST /me/update": () => null,
    "GET /me/sshkey/list": () => ({ content: structuredClone(KEYS), total: 1 }),
    "POST /me/sshkey/add": () => null,
    "POST /me/sshkey/delete": () => null,
    "POST /auth/2fa/generate": () => ({
      qr: "data:image/png;base64,AAA",
      secret: "SECRET",
    }),
    "POST /auth/2fa/verify": () => null,
  })
})

const confirmIfAsked = async () => {
  const c = [...document.querySelectorAll("button")].find(
    (b) => b.textContent?.trim() === "Confirm",
  )
  if (c) {
    fireEvent.click(c)
    await settle()
  }
}

describe("profile", () => {
  it("saves username and password, then goes to the login page", async () => {
    renderPage(() => <Profile />)
    await settle()
    setValue(document.getElementById("username")!, "root")
    setValue(document.getElementById("password")!, "pw1")
    setValue(document.getElementById("confirm-password")!, "pw1")
    await clickButton("Save")
    expectGolden("profile-update", lastCall("POST", "/me/update")!.body)
    expect(router.to).toHaveBeenCalledTimes(1)
    expect(String(router.to.mock.calls[0][0])).toContain("/@login")
    expect(me().username).toBe("root")
  })

  it("does not save when the confirmation differs", async () => {
    renderPage(() => <Profile />)
    await settle()
    setValue(document.getElementById("password")!, "pw1")
    setValue(document.getElementById("confirm-password")!, "pw2")
    await clickButton("Save")
    expect(writes()).toHaveLength(0)
    expect(notify.warning).toHaveBeenCalledTimes(1)
  })

  it("adds and deletes an ssh key of the current user", async () => {
    renderPage(() => <Profile />)
    await settle()
    expect(document.body.textContent).toContain("laptop")
    // two "Add" buttons are possible (keys, webauthn): the keys one is the only one here
    fireEvent.click(buttonByText("Add"))
    await settle()
    setValue(document.getElementById("add_title")!, "desk")
    setValue(document.getElementById("add_key")!, "ssh-ed25519 AAAA")
    const adds = [...document.querySelectorAll("button")].filter(
      (b) => b.textContent?.trim() === "Add",
    )
    fireEvent.click(adds[adds.length - 1])
    await settle()
    await openRowMenu(0)
    await chooseMenuItem("Delete")
    await confirmIfAsked()
    expectGolden(
      "profile-keys",
      writes().map((c) => [c.method, c.path, c.query, c.body ?? null]),
    )
  })

  it("a guest only sees the notice", async () => {
    setMe({ ...ADMIN_ME, role: 1 } as any)
    renderPage(() => <Profile />)
    await settle()
    expect(document.getElementById("username")).toBeNull()
  })

  it("a user without manage-user-info cannot edit credentials", async () => {
    setMe({ ...ADMIN_ME, role: 0, permission: 0 } as any)
    renderPage(() => <Profile />)
    await settle()
    expect(document.getElementById("username")).toBeNull()
    expect(document.getElementById("password")).toBeNull()
  })
})

describe("2fa", () => {
  it("verifies the code with the generated secret", async () => {
    renderPage(() => <TwoFA />)
    await settle()
    expect(document.body.textContent).toContain("SECRET")
    const input = document.querySelector("input")!
    setValue(input, "123456")
    await clickButton("Verify")
    expectGolden("2fa-verify", lastCall("POST", "/auth/2fa/verify")!.body)
    expect(router.back).toHaveBeenCalled()
  })
})
