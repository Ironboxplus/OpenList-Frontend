import { fireEvent, render, screen } from "@solidjs/testing-library"
import { afterEach, describe, expect, it, vi } from "vitest"

const to = vi.fn()
vi.mock("~/hooks", async () => {
  const i18n = await import("@solid-primitives/i18n")
  const { dict } = await import("~/lang/en/entry")
  const flat = i18n.flatten(dict) as unknown as Record<string, string>
  return {
    useT: () => (key: string, params?: Record<string, string | number>) => {
      const tpl = flat[key]
      if (typeof tpl !== "string") return key
      return params ? i18n.resolveTemplate(tpl, params) : tpl
    },
    useRouter: () => ({ to }),
  }
})

import { UserRole } from "~/types"
import { SettingsHome } from "../SettingsHome"
import { settingsForBackend, visibleSettings } from "../registry"

afterEach(() => {
  to.mockClear()
})

const admin = { role: UserRole.ADMIN, permission: 0 }

describe("SettingsHome", () => {
  it("shows every group with a card per entry", () => {
    const { container } = render(() => (
      <SettingsHome items={visibleSettings(admin)} />
    ))
    expect(container.querySelectorAll("section[data-group]")).toHaveLength(6)
    expect(container.querySelectorAll("a[data-setting]")).toHaveLength(
      settingsForBackend().length,
    )
  })

  it("only shows the entries it is given (permission filtering is the caller's)", () => {
    const general = { role: UserRole.GENERAL, permission: 0 }
    const { container } = render(() => (
      <SettingsHome items={visibleSettings(general)} />
    ))
    const ids = [...container.querySelectorAll("a[data-setting]")].map((a) =>
      a.getAttribute("data-setting"),
    )
    expect(ids.sort()).toEqual(["about", "docs", "shares"])
  })

  it("filters with the shared matcher, by an inner setting name", () => {
    const { container } = render(() => (
      <SettingsHome items={visibleSettings(admin)} />
    ))
    const box = screen.getByRole("searchbox")
    fireEvent.input(box, { target: { value: "bandwidth" } })
    const ids = [...container.querySelectorAll("a[data-setting]")].map((a) =>
      a.getAttribute("data-setting"),
    )
    expect(ids).toContain("transfers")
    expect(ids).not.toContain("users")
    expect(
      container.querySelectorAll("section[data-group]").length,
    ).toBeLessThan(6)
  })

  it("finds a single setting, folded or not, and leads to it on its page", () => {
    const { container } = render(() => (
      <SettingsHome items={visibleSettings(admin)} />
    ))
    fireEvent.input(screen.getByRole("searchbox"), {
      target: { value: "Ignore direct link params" },
    })
    const hit = container.querySelector(
      'a[data-setting-hit="ignore_direct_link_params"]',
    ) as HTMLAnchorElement
    expect(hit).toBeTruthy()
    expect(hit.textContent).toContain("Global")
    expect(hit.getAttribute("href")).toMatch(
      /\/@manage\/settings\/global\?focus=ignore_direct_link_params$/,
    )
    fireEvent.click(hit)
    expect(to).toHaveBeenCalledWith(
      "/@manage/settings/global?focus=ignore_direct_link_params",
    )
    // and its page is among the pages found
    expect(container.querySelector('a[data-setting="global"]')).toBeTruthy()
  })

  it("finds a setting by its key too", () => {
    const { container } = render(() => (
      <SettingsHome items={visibleSettings(admin)} />
    ))
    fireEvent.input(screen.getByRole("searchbox"), {
      target: { value: "move_task_threads_num" },
    })
    expect(
      container
        .querySelector('a[data-setting-hit="move_task_threads_num"]')
        ?.getAttribute("href"),
    ).toMatch(/\/@manage\/settings\/transfer\?focus=move_task_threads_num$/)
  })

  it("lists no single settings without a query", () => {
    const { container } = render(() => (
      <SettingsHome items={visibleSettings(admin)} />
    ))
    expect(container.querySelector("[data-setting-hit]")).toBeNull()
  })

  it("explains an empty result and clears it", () => {
    render(() => <SettingsHome items={visibleSettings(admin)} />)
    fireEvent.input(screen.getByRole("searchbox"), {
      target: { value: "qqqqzzzz" },
    })
    expect(screen.getByTestId("settings-empty").textContent).toContain(
      "qqqqzzzz",
    )
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }))
    expect(screen.queryByTestId("settings-empty")).toBeNull()
  })

  it("navigates through the router on a plain click and leaves modified clicks alone", () => {
    const { container } = render(() => (
      <SettingsHome items={visibleSettings(admin)} />
    ))
    const link = container.querySelector('a[data-setting="transfers"]')!
    fireEvent.click(link)
    expect(to).toHaveBeenCalledWith("/@manage/settings/transfer")
    to.mockClear()
    fireEvent.click(link, { ctrlKey: true })
    expect(to).not.toHaveBeenCalled()
  })

  it("opens external entries in a new tab", () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null)
    const { container } = render(() => (
      <SettingsHome items={visibleSettings(admin)} />
    ))
    fireEvent.click(container.querySelector('a[data-setting="docs"]')!)
    expect(open).toHaveBeenCalledWith(
      "https://doc.oplist.org",
      "_blank",
      "noopener,noreferrer",
    )
    expect(to).not.toHaveBeenCalled()
    open.mockRestore()
  })
})
