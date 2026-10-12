import { fireEvent, render, screen } from "@solidjs/testing-library"
import { createSignal } from "solid-js"
import { afterEach, describe, expect, it, vi } from "vitest"

const to = vi.fn()
vi.mock("~/hooks", async () => {
  const i18n = await import("@solid-primitives/i18n")
  const { dict } = await import("~/lang/en/entry")
  const flat = i18n.flatten(dict) as unknown as Record<string, string>
  return {
    useT: () => (key: string) => flat[key] ?? key,
    useRouter: () => ({ to }),
  }
})

import { UserRole } from "~/types"
import { SettingsNav } from "../SettingsNav"
import { SettingsTopLeft } from "../SettingsTopLeft"
import { groupSettings, settingsForBackend, visibleSettings } from "../registry"

afterEach(() => to.mockClear())

const admin = { role: UserRole.ADMIN, permission: 0 }
const sections = groupSettings(visibleSettings(admin))

const nav = (
  over: { pathname?: string; hash?: string; collapsed?: boolean } = {},
) =>
  render(() => (
    <SettingsNav
      sections={sections}
      pathname={over.pathname ?? "/@manage/settings/traffic"}
      hash={over.hash ?? ""}
      collapsed={over.collapsed ?? false}
      onToggle={() => {}}
    />
  ))

describe("SettingsNav", () => {
  it("lists the six groups and every page, and never a Settings entry", () => {
    const { container } = nav()
    expect(container.querySelectorAll("section")).toHaveLength(6)
    expect(container.querySelectorAll("[data-settings-nav-item]")).toHaveLength(
      settingsForBackend().length,
    )
    const labels = [...container.querySelectorAll("a")].map((a) =>
      a.textContent?.trim(),
    )
    expect(labels).not.toContain("Settings")
    expect(container.querySelectorAll("h2")).toHaveLength(6)
  })

  it("marks the current page, only one", () => {
    const { container } = nav()
    const current = container.querySelectorAll('[aria-current="page"]')
    expect(current).toHaveLength(1)
    expect(current[0].getAttribute("data-settings-nav-item")).toBe("traffic")
  })

  it("marks the cluster entry, not plugins, on the cluster hash", () => {
    const { container } = nav({
      pathname: "/@manage/plugins",
      hash: "#cluster",
    })
    expect(
      container
        .querySelector('[aria-current="page"]')
        ?.getAttribute("data-settings-nav-item"),
    ).toBe("cluster")
  })

  it("navigates through the router", () => {
    const { container } = nav()
    fireEvent.click(
      container.querySelector('[data-settings-nav-item="users"]')!,
    )
    expect(to).toHaveBeenCalledWith("/@manage/users")
  })

  it("collapses to icons with accessible names", () => {
    const { container } = nav({ collapsed: true })
    expect(container.querySelectorAll("h2")).toHaveLength(0)
    const item = container.querySelector('[data-settings-nav-item="traffic"]')!
    expect(item.getAttribute("aria-label")).toBe("Traffic")
    expect(item.textContent?.trim()).toBe("")
  })

  it("the toggle calls back and reflects the state", () => {
    const [c, setC] = createSignal(false)
    render(() => (
      <SettingsNav
        sections={sections}
        pathname="/@manage"
        hash=""
        collapsed={c()}
        onToggle={() => setC(!c())}
      />
    ))
    const btn = screen.getByRole("button", { name: "Collapse" })
    expect(btn.getAttribute("aria-expanded")).toBe("true")
    fireEvent.click(btn)
    expect(
      screen
        .getByRole("button", { name: "Expand settings menu" })
        .getAttribute("aria-expanded"),
    ).toBe("false")
  })
})

describe("SettingsTopLeft", () => {
  it("desktop: Settings links home, group and page follow", () => {
    const { container } = render(() => (
      <SettingsTopLeft
        phone={false}
        pathname="/@manage/settings/traffic"
        hash=""
      />
    ))
    const items = [...container.querySelectorAll("li")].map((l) =>
      l.textContent?.trim(),
    )
    expect(items).toEqual(["Settings", "Storage and transfer", "Traffic"])
    fireEvent.click(screen.getByRole("link", { name: "Settings" }))
    expect(to).toHaveBeenCalledWith("/@manage")
    expect(container.querySelector('[aria-current="page"]')?.textContent).toBe(
      "Traffic",
    )
  })

  it("phone: back button to the settings home plus the page title", () => {
    const { container } = render(() => (
      <SettingsTopLeft phone pathname="/@manage/settings/traffic" hash="" />
    ))
    expect(container.textContent).toContain("Traffic")
    fireEvent.click(container.querySelector("[data-settings-back]")!)
    expect(to).toHaveBeenCalledWith("/@manage")
  })

  it("phone: no back button on the settings home", () => {
    const { container } = render(() => (
      <SettingsTopLeft phone pathname="/@manage" hash="" />
    ))
    expect(container.querySelector("[data-settings-back]")).toBeNull()
    expect(container.textContent).toContain("Settings")
  })
})
