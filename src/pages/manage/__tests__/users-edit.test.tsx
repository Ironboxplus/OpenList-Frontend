import { fireEvent } from "@solidjs/testing-library"
import { beforeEach, describe, expect, it, vi } from "vitest"
vi.mock("~/hooks", async (orig) =>
  (await import("./mocks")).hooksMock(await orig()),
)
vi.mock("~/utils/notify", async () => (await import("./mocks")).notifyMock())

import { setMe } from "~/store"
import { UserPermissions } from "~/types"
import AddOrEdit, { PERMISSION_GROUPS } from "../users/AddOrEdit"
import { ADMIN_ME, KEYS, USER } from "./fixtures"
import {
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

/** The checkbox of one permission, whichever group box it sits in. */
const perm = (name: string) =>
  document.querySelector(`[data-permission=${name}] input`) as HTMLInputElement
const boxes = () =>
  [...document.querySelectorAll("input[type=checkbox]")] as HTMLInputElement[]

describe("user editor payloads", () => {
  it("add: username, password, base path, permission bits and flags", async () => {
    renderPage(() => <AddOrEdit />)
    await settle()
    setValue(document.getElementById("username")!, "bob")
    setValue(document.getElementById("password")!, "s3cret")
    setValue(document.getElementById("base_path")!, "/bob")
    fireEvent.click(perm("see_hides"))
    fireEvent.click(perm("write_content"))
    fireEvent.click(perm("manage_user_info"))
    toggleField("disabled")
    toggleField("allow_ldap")
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
    fireEvent.click(perm("see_hides")) // clear (bit 0 set in fixture)
    fireEvent.click(perm("access_without_password"))
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

describe("permission groups", () => {
  it("place every permission bit exactly once", () => {
    const placed = PERMISSION_GROUPS.flatMap((g) => g.names)
    expect([...placed].sort()).toEqual([...UserPermissions].sort())
  })
})
