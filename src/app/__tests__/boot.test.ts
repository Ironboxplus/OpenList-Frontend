import { beforeEach, describe, expect, it, vi } from "vitest"

const { initPluginEngine, applyCustomize } = vi.hoisted(() => ({
  initPluginEngine: vi.fn(),
  applyCustomize: vi.fn(),
}))
vi.mock("~/utils/plugin_engine", () => ({ initPluginEngine }))
vi.mock("~/utils/customize", () => ({ applyCustomize }))
// The real store pulls in the whole UI kit; what matters here is that it
// records the backend kind from the settings, as store/settings.ts does.
vi.mock("~/store/settings", async () => {
  const { setBackendKind } = await import("~/utils/backend")
  return {
    setSettings: (s: Record<string, string>) => setBackendKind(s["backend"]),
  }
})

import { onSettingsLoaded } from "../boot"

beforeEach(() => {
  initPluginEngine.mockClear()
  applyCustomize.mockClear()
})

describe("onSettingsLoaded", () => {
  it("does not start the upstream plugin engine on the Go backend", () => {
    // The Go backend sends no `backend` field.
    onSettingsLoaded({ version: "v4" })
    expect(initPluginEngine).not.toHaveBeenCalled()
    expect(
      (window as { OpenListPlugin?: unknown }).OpenListPlugin,
    ).toBeUndefined()
    expect(applyCustomize).toHaveBeenCalledTimes(1)
  })

  it("starts the plugin engine on the TS backend", () => {
    onSettingsLoaded({ version: "v4", backend: "ts-worker" })
    expect(initPluginEngine).toHaveBeenCalledTimes(1)
    expect(applyCustomize).toHaveBeenCalledTimes(1)
  })

  it("switches back when reconnecting to a Go backend", () => {
    onSettingsLoaded({ backend: "ts-worker" })
    initPluginEngine.mockClear()
    onSettingsLoaded({})
    expect(initPluginEngine).not.toHaveBeenCalled()
  })
})
