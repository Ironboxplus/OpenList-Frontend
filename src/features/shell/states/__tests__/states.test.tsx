import { fireEvent, render, screen } from "@solidjs/testing-library"
import { afterEach, describe, expect, it, vi } from "vitest"

const to = vi.fn()
vi.mock("~/hooks", async () => {
  const i18n = await import("@solid-primitives/i18n")
  const { dict } = await import("~/lang/en/entry")
  const flat = i18n.flatten(dict) as Record<string, string>
  return {
    useT: () => (key: string) => flat[key] ?? key,
    useRouter: () => ({ to }),
  }
})

import { BackendUnavailable } from "../BackendUnavailable"
import { Forbidden } from "../Forbidden"
import { NotFound } from "../NotFound"
import { Offline } from "../Offline"
import { initializedFrom, startupStateFor } from "../startup"

afterEach(() => {
  to.mockClear()
})

describe("NotFound", () => {
  it("explains and returns to files", () => {
    render(() => <NotFound />)
    expect(screen.getByRole("heading").textContent).toBe("Page not found")
    fireEvent.click(screen.getByRole("button", { name: "Back to files" }))
    expect(to).toHaveBeenCalledWith("/")
  })
})

describe("Forbidden", () => {
  it("offers back and switch account", () => {
    const back = vi.spyOn(window.history, "back").mockImplementation(() => {})
    render(() => <Forbidden />)
    fireEvent.click(screen.getByRole("button", { name: "Go back" }))
    expect(back).toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Switch account" }))
    expect(to).toHaveBeenCalledWith("/@login", true)
    back.mockRestore()
  })
})

describe("Offline", () => {
  it("retries on the button and on the online event, and stops after unmount", () => {
    const onRetry = vi.fn()
    const { unmount } = render(() => <Offline onRetry={onRetry} />)
    expect(screen.getByRole("heading").textContent).toBe("You are offline")
    fireEvent.click(screen.getByRole("button", { name: "Retry" }))
    expect(onRetry).toHaveBeenCalledTimes(1)
    window.dispatchEvent(new Event("online"))
    expect(onRetry).toHaveBeenCalledTimes(2)
    unmount()
    window.dispatchEvent(new Event("online"))
    expect(onRetry).toHaveBeenCalledTimes(2)
  })

  it("disables the button while retrying", () => {
    render(() => <Offline onRetry={() => {}} retrying />)
    expect(
      (screen.getByRole("button", { name: "Retry" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true)
  })
})

describe("BackendUnavailable", () => {
  it("shows request id and error code when present", () => {
    const onRetry = vi.fn()
    render(() => (
      <BackendUnavailable
        error={{ code: "http_502", requestId: "req-9" }}
        onRetry={onRetry}
      />
    ))
    expect(screen.getByText(/http_502/)).toBeTruthy()
    expect(screen.getByText(/req-9/)).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Retry" }))
    expect(onRetry).toHaveBeenCalled()
  })

  it("omits the details box without an error", () => {
    render(() => <BackendUnavailable onRetry={() => {}} />)
    expect(screen.queryByText(/Request ID/)).toBeNull()
    expect(screen.queryByText(/Error code/)).toBeNull()
  })
})

describe("startupStateFor", () => {
  const fail = (category: string) => ({ category }) as never
  const table = [
    ["offline browser beats everything", "network", false, "offline"],
    ["refused connection while online", "network", true, "backend"],
    ["timeout", "timeout", true, "backend"],
    ["5xx", "internal", true, "backend"],
    ["403", "permission", true, "forbidden"],
    ["anything else", "provider", true, "backend"],
  ] as const
  it.each(table)("%s", (_n, category, online, expected) => {
    expect(startupStateFor({ settingsError: fail(category), online })).toBe(
      expected,
    )
  })

  it("is ready when settings loaded", () => {
    expect(startupStateFor({ online: true })).toBe("ready")
  })

  // The four init_status outcomes, with the settings request failing the way
  // an uninitialized backend makes it fail (503).
  const settings503 = fail("internal")
  it("goes to the wizard only when init_status says initialized:false", () => {
    expect(
      startupStateFor({
        settingsError: settings503,
        online: true,
        initialized: false,
      }),
    ).toBe("uninitialized")
  })
  it("keeps the settings failure a startup failure when init_status is unknown or true", () => {
    for (const initialized of [undefined, true])
      expect(
        startupStateFor({
          settingsError: settings503,
          online: true,
          initialized,
        }),
      ).toBe("backend")
  })
  it("treats uninitialized with working settings as uninitialized too", () => {
    expect(startupStateFor({ online: true, initialized: false })).toBe(
      "uninitialized",
    )
    expect(startupStateFor({ online: true, initialized: true })).toBe("ready")
  })
})

describe("initializedFrom", () => {
  const ok = (data: unknown) => ({ ok: true as const, data }) as never
  const failed = (category: string) =>
    ({ ok: false as const, error: { category } }) as never

  it("reads an explicit answer", () => {
    expect(initializedFrom(ok({ initialized: false }))).toBe(false)
    expect(initializedFrom(ok({ initialized: true }))).toBe(true)
  })
  it("is unknown for a 404 (backend without the endpoint) and network errors", () => {
    expect(initializedFrom(failed("validation"))).toBeUndefined()
    expect(initializedFrom(failed("network"))).toBeUndefined()
  })
  it("is unknown for a malformed body", () => {
    expect(initializedFrom(ok(null))).toBeUndefined()
    expect(initializedFrom(ok({}))).toBeUndefined()
  })
})
