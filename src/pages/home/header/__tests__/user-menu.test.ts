import { describe, it, expect } from "vitest"
import { userMenuEntries } from "../user-menu"
import { UserRole, type User } from "~/types"

function makeUser(role: UserRole): User {
  return {
    id: 1,
    username: role === UserRole.GUEST ? "guest" : "user",
    password: "",
    base_path: "/",
    role,
    permission: 0,
    sso_id: "",
    disabled: false,
    allow_ldap: false,
  }
}

describe("userMenuEntries", () => {
  it("offers only login to a guest", () => {
    const entries = userMenuEntries(makeUser(UserRole.GUEST))
    expect(entries.map((e) => e.id)).toEqual(["login"])
    expect(entries[0].labelKey).toBe("login.login")
    expect(entries[0].kind).toBe("link")
  })

  it("offers manage + logout to an admin", () => {
    const entries = userMenuEntries(makeUser(UserRole.ADMIN))
    expect(entries.map((e) => e.id)).toEqual(["manage", "logout"])
  })

  it("offers manage + logout to a general user", () => {
    const entries = userMenuEntries(makeUser(UserRole.GENERAL))
    expect(entries.map((e) => e.id)).toEqual(["manage", "logout"])
  })

  it("marks logout as a destructive action, not a link", () => {
    const entries = userMenuEntries(makeUser(UserRole.GENERAL))
    const logout = entries.find((e) => e.id === "logout")!
    expect(logout.kind).toBe("action")
    expect(logout.danger).toBe(true)
    expect(logout.labelKey).toBe("manage.logout")
  })

  it("manage entry links to the manage area", () => {
    const entries = userMenuEntries(makeUser(UserRole.ADMIN))
    const manage = entries.find((e) => e.id === "manage")!
    expect(manage.kind).toBe("link")
    expect(manage.href).toBe("/@manage")
    expect(manage.labelKey).toBe("home.footer.manage")
  })
})
