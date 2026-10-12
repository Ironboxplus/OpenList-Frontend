import { fireEvent } from "@solidjs/testing-library"
import { beforeEach, describe, expect, it, vi } from "vitest"
vi.mock("~/hooks", async (orig) =>
  (await import("./mocks")).hooksMock(await orig()),
)
vi.mock("~/utils/notify", async () => (await import("./mocks")).notifyMock())

import { setMe } from "~/store"
import AddOrEdit from "../users/AddOrEdit"
import { ADMIN_ME, KEYS, USER } from "./fixtures"
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
import { resetRouter, router } from "./mocks"

beforeEach(() => {
  resetRouter()
  setMe(structuredClone(ADMIN_ME) as any)
  mockApi({
    "GET /admin/user/get": () => structuredClone(USER),
    "GET /admin/user/sshkey/list": () => ({ content: KEYS, total: 1 }),
    "POST /admin/user/create": () => null,
    "POST /admin/user/update": () => null,
    "POST /admin/user/sshkey/delete": () => null,
    "GET /me": () => structuredClone(ADMIN_ME),
  })
})

/** Checkboxes in DOM order: one per permission bit, then disabled, allow_ldap. */
const boxes = () =>
  [...document.querySelectorAll("input[type=checkbox]")] as HTMLInputElement[]

describe("user editor payloads", () => {
  it("add: username, password, base path, permission bits and flags", async () => {
    renderPage(() => <AddOrEdit />)
    await settle()
    setValue(document.getElementById("username")!, "bob")
    setValue(document.getElementById("password")!, "s3cret")
    setValue(document.getElementById("base_path")!, "/bob")
    const all = boxes()
    fireEvent.click(all[0]) // see_hides
    fireEvent.click(all[3]) // write_content
    fireEvent.click(all[16]) // manage_user_info
    fireEvent.click(document.getElementById("disabled")!)
    fireEvent.click(document.getElementById("allow_ldap")!)
    await clickButton("Add")
    expectGolden("user-create", lastCall("POST", "/admin/user/create")!.body)
    expect(router.to).toHaveBeenCalledWith("/@manage/users", false, {
      replace: true,
    })
  })

  it("edit: loads the user, clears a permission bit, saves and returns to the list", async () => {
    router.params = { id: "5" }
    renderPage(() => <AddOrEdit />)
    await settle()
    expect(
      (document.getElementById("username") as HTMLInputElement).value,
    ).toBe("alice")
    fireEvent.click(boxes()[0]) // clear see_hides (bit 0 set in fixture)
    fireEvent.click(boxes()[1]) // set access_without_password
    await clickButton("Save")
    expectGolden("user-update", lastCall("POST", "/admin/user/update")!.body)
    expect(router.to).toHaveBeenCalledWith("/@manage/users", false, {
      replace: true,
    })
  })

  it("edit: a delegated (non-admin) editor sees only username and password", async () => {
    setMe({ ...ADMIN_ME, role: 0, permission: 1 << 16 } as any)
    router.params = { id: "5" }
    renderPage(() => <AddOrEdit />)
    await settle()
    expect(document.getElementById("username")).toBeTruthy()
    expect(document.getElementById("base_path")).toBeNull()
    expect(boxes()).toHaveLength(0)
  })

  it("edit: lists ssh keys of the user being edited", async () => {
    router.params = { id: "5" }
    renderPage(() => <AddOrEdit />)
    await settle()
    expect(lastCall("GET", "/admin/user/sshkey/list")?.query).toEqual({
      uid: "5",
    })
    expect(document.body.textContent).toContain("laptop")
  })

  it("edit: the guest account has no username/password/keys", async () => {
    mockApi({
      "GET /admin/user/get": () => ({
        ...USER,
        id: 2,
        username: "guest",
        role: 1,
      }),
      "GET /admin/user/sshkey/list": () => ({ content: [], total: 0 }),
    })
    router.params = { id: "2" }
    renderPage(() => <AddOrEdit />)
    await settle()
    expect(document.getElementById("username")).toBeNull()
    expect(writes()).toHaveLength(0)
  })
})
