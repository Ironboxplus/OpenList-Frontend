import { fireEvent } from "@solidjs/testing-library"
import { beforeEach, describe, expect, it, vi } from "vitest"
vi.mock("~/hooks", async (orig) =>
  (await import("./mocks")).hooksMock(await orig()),
)
vi.mock("~/utils/notify", async () => (await import("./mocks")).notifyMock())

import { setMe } from "~/store"
import Users from "../users/Users"
import { ADMIN_ME, USER } from "./fixtures"
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
  { ...ADMIN_ME, id: 1, username: "admin" },
  { ...USER, id: 5, username: "alice" },
]

beforeEach(() => {
  resetRouter()
  setMe(structuredClone(ADMIN_ME) as any)
  mockApi({
    "GET /admin/user/list": () => ({
      content: structuredClone(list),
      total: 2,
    }),
    "POST /admin/user/delete": () => null,
    "POST /admin/user/cancel_2fa": () => null,
  })
})

const nth = (label: string, i: number) =>
  [...document.querySelectorAll("button")].filter(
    (b) => b.textContent?.trim() === label,
  )[i]

describe("user list", () => {
  it("lists users and navigates to add / edit", async () => {
    renderPage(() => <Users />)
    await settle()
    expect(document.body.textContent).toContain("alice")
    fireEvent.click(buttonByText("Add"))
    expect(router.to).toHaveBeenCalledWith("/@manage/users/add")
    fireEvent.click(nth("Edit", 1))
    expect(router.to).toHaveBeenCalledWith("/@manage/users/edit/5")
  })

  it("delete (after confirmation) and cancel-2fa post the user id", async () => {
    renderPage(() => <Users />)
    await settle()
    fireEvent.click(nth("Delete", 1))
    await settle()
    await clickButton("Confirm")
    fireEvent.click(nth("Cancel 2FA", 1))
    await settle()
    expectGolden(
      "users-list-writes",
      writes().map((c) => [c.method, c.path, c.query]),
    )
    expect(writes()).toHaveLength(2)
  })

  it("delete needs a second confirmation", async () => {
    renderPage(() => <Users />)
    await settle()
    fireEvent.click(nth("Delete", 1))
    await settle()
    expect(writes()).toHaveLength(0)
  })
})
