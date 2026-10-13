import { render, screen, waitFor } from "@solidjs/testing-library"
import { HopeProvider } from "@hope-ui/solid"
import { createSignal, onCleanup, type JSX } from "solid-js"
import { beforeEach, describe, expect, it, vi } from "vitest"

const [path, setPath] = createSignal("/@dashboard")
vi.mock("~/hooks", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/hooks")>()),
  useT: () => (k: string) => k,
  useRouter: () => ({
    pathname: path,
    isShare: () => path().startsWith("/@s"),
  }),
}))

import { bus } from "~/utils"
import { me, setMe } from "~/store"
import { SessionGate, sameUser } from "../MustUser"

const user = (over: Record<string, unknown> = {}) =>
  ({
    id: 7,
    username: "u",
    password: "",
    base_path: "/",
    role: 2,
    disabled: false,
    permission: 1,
    sso_id: "",
    otp: false,
    allow_ldap: false,
    ...over,
  }) as any

const mount = (ui: () => JSX.Element) =>
  render(() => <HopeProvider>{ui()}</HopeProvider>)

const ok = (data: any) => ({ code: 200, message: "ok", data })

let mounts = 0
let unmounts = 0
const Probe = () => {
  mounts++
  onCleanup(() => unmounts++)
  return <div>child</div>
}

beforeEach(() => {
  mounts = 0
  unmounts = 0
  setMe({} as any)
  setPath("/@dashboard")
  vi.restoreAllMocks()
})

describe("SessionGate", () => {
  it("holds the children until the first /me, then asks only on a section change", async () => {
    const fetchMe = vi.fn(async () => ok(user()))
    mount(() => (
      <SessionGate fetchMe={fetchMe}>
        <Probe />
      </SessionGate>
    ))
    expect(screen.queryByText("child")).toBeNull()
    await screen.findByText("child")
    expect(fetchMe).toHaveBeenCalledTimes(1)

    // Same section (a directory change in the file browser): no request.
    setPath("/@dashboard")
    await Promise.resolve()
    expect(fetchMe).toHaveBeenCalledTimes(1)

    // Another section: revalidated in the background, the subtree stays.
    const first = me()
    setPath("/@transfers")
    await waitFor(() => expect(fetchMe).toHaveBeenCalledTimes(2))
    await Promise.resolve()
    expect(mounts).toBe(1)
    expect(unmounts).toBe(0)
    expect(screen.getByText("child")).toBeTruthy()
    // An equal answer must not replace me().
    expect(me()).toBe(first)
  })

  it("replaces me() when the user really changed", async () => {
    const fetchMe = vi
      .fn()
      .mockResolvedValueOnce(ok(user()))
      .mockResolvedValueOnce(ok(user({ permission: 5 })))
    mount(() => (
      <SessionGate fetchMe={fetchMe}>
        <Probe />
      </SessionGate>
    ))
    await screen.findByText("child")
    setPath("/@media")
    await waitFor(() => expect(me().permission).toBe(5))
    expect(unmounts).toBe(0)
  })

  it("sets a guest when the /me of a share page fails", async () => {
    setPath("/@s/abc")
    const fetchMe = vi.fn(async () => ({
      code: 401,
      message: "no",
      data: null,
    }))
    mount(() => (
      <SessionGate fetchMe={fetchMe as any}>
        <Probe />
      </SessionGate>
    ))
    await screen.findByText("child")
    expect(me().username).toBe("guest")
  })

  it("sends a 401 on any other page to the login page and keeps the spinner", async () => {
    const to = vi.fn()
    bus.on("to", to)
    const fetchMe = vi.fn(async () => ({
      code: 401,
      message: "no",
      data: null,
    }))
    mount(() => (
      <SessionGate fetchMe={fetchMe as any}>
        <Probe />
      </SessionGate>
    ))
    await waitFor(() => expect(to).toHaveBeenCalled())
    expect(mounts).toBe(0)
    bus.off("to", to)
  })
})

describe("sameUser", () => {
  it("compares every field of the user", () => {
    expect(sameUser(user(), user())).toBe(true)
    expect(sameUser(user(), user({ role: 1 }))).toBe(false)
    expect(sameUser(user(), user({ base_path: "/x" }))).toBe(false)
  })
})
