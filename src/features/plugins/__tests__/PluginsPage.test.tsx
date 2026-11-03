import { fireEvent, render, screen } from "@solidjs/testing-library"
import { beforeEach, describe, expect, it, vi } from "vitest"

const h = vi.hoisted(() => ({ admin: { v: false } }))
vi.mock("~/hooks", async () => {
  const i18n = await import("@solid-primitives/i18n")
  const { dict } = await import("~/lang/en/entry")
  const flat = i18n.flatten(dict) as Record<string, string>
  return {
    useT: () => (key: string, params?: Record<string, string | number>) => {
      const tpl = flat[key]
      if (typeof tpl !== "string") return key
      return params ? i18n.resolveTemplate(tpl, params) : tpl
    },
    useTitle: () => {},
    useRouter: () => ({ to: vi.fn() }),
  }
})
vi.mock("~/store", () => ({ me: () => ({ role: h.admin.v ? 2 : 0 }) }))
vi.mock("~/utils/config", () => ({ base_path: "" }))

import {
  plugins,
  registerPlugin,
  unregisterPlugin,
  type Plugin,
} from "~/plugins/registry"
import { topBarSlots } from "../../shell/topbar-slot"
import PluginsPage from "../PluginsPage"
import { pluginRows } from "../model"

const C = () => null
const alpha: Plugin = {
  id: "t.alpha",
  name: "Alpha",
  version: "1.2.0",
  contributions: [
    { slot: "dashboard", component: C },
    { slot: "dashboard", component: C, order: 2 },
    { slot: "header-right", component: C },
  ],
}
const beta: Plugin = {
  id: "t.beta",
  contributions: [{ slot: "dashboard", component: C }],
}

beforeEach(() => {
  localStorage.clear()
  for (const p of plugins()) unregisterPlugin(p.id)
  h.admin.v = false
  registerPlugin(alpha)
  registerPlugin(beta)
})

describe("pluginRows", () => {
  it("maps the registry: name falls back to id, slots are unique", () => {
    expect(pluginRows(plugins())).toEqual([
      {
        id: "t.alpha",
        name: "Alpha",
        version: "1.2.0",
        slots: ["dashboard", "header-right"],
        enabled: true,
      },
      {
        id: "t.beta",
        name: "t.beta",
        version: undefined,
        slots: ["dashboard"],
        enabled: true,
      },
    ])
  })
})

// The system-plugins link lives in the TopBar's right slot; the page registers it.
const PageWithTopBar = () => (
  <>
    <div data-topbar>{topBarSlots()?.right?.({ phone: false })}</div>
    <PluginsPage />
  </>
)

describe("PluginsPage", () => {
  it("lists every registered plugin with id, version and slots", () => {
    render(() => <PluginsPage />)
    const rows = screen.getAllByTestId("plugin-row")
    expect(rows.map((r) => r.getAttribute("data-plugin"))).toEqual([
      "t.alpha",
      "t.beta",
    ])
    expect(rows[0].textContent).toContain("Alpha")
    expect(rows[0].textContent).toContain("Version 1.2.0")
    expect(rows[0].textContent).toContain("dashboard, header-right")
  })

  it("says the switch is for this browser only", () => {
    render(() => <PluginsPage />)
    expect(document.body.textContent).toContain("only affects this browser")
  })

  it("switching off disables the plugin and persists the choice", () => {
    render(() => <PluginsPage />)
    const toggle = document.querySelector<HTMLInputElement>(
      "input[type=checkbox]",
    )!
    expect(toggle.checked).toBe(true)
    fireEvent.click(toggle)
    expect(plugins().find((p) => p.id === "t.alpha")!.enabled).toBe(false)
    expect(
      JSON.parse(localStorage.getItem("plugin-enabled-overrides")!),
    ).toEqual({ "t.alpha": false })
    // a reload registers the plugin again and the stored choice wins
    registerPlugin(alpha)
    expect(plugins().find((p) => p.id === "t.alpha")!.enabled).toBe(false)
  })

  it("links to system plugins for admins only, and offers no install or delete", () => {
    const { unmount } = render(() => <PageWithTopBar />)
    expect(screen.queryByTestId("system-plugins-link")).toBeNull()
    unmount()
    h.admin.v = true
    render(() => <PageWithTopBar />)
    expect(screen.getByTestId("system-plugins-link").getAttribute("href")).toBe(
      "/@manage/plugins",
    )
    expect(document.body.textContent).not.toMatch(/install|delete|remove/i)
  })

  it("shows the empty state without plugins", () => {
    for (const p of plugins()) unregisterPlugin(p.id)
    render(() => <PluginsPage />)
    expect(document.querySelector("[data-state=empty]")).toBeTruthy()
  })
})
