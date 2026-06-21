import { describe, it, expect, vi } from "vitest"
import type { Component } from "solid-js"
import { applyEnabledOverride, type Plugin } from "../registry"
import { loadExternalPlugins, type ExternalManifest } from "../loader"

const Comp: Component = () => null

function plugin(id: string, enabled?: boolean): Plugin {
  return {
    id,
    enabled,
    contributions: [{ slot: "header-right", component: Comp }],
  }
}

describe("applyEnabledOverride", () => {
  it("forces enabled=false when overridden off", () => {
    const out = applyEnabledOverride(plugin("p"), { p: false })
    expect(out.enabled).toBe(false)
  })

  it("forces enabled=true when overridden on", () => {
    const out = applyEnabledOverride(plugin("p", false), { p: true })
    expect(out.enabled).toBe(true)
  })

  it("leaves the plugin untouched when no override exists", () => {
    const p = plugin("p")
    expect(applyEnabledOverride(p, {})).toBe(p)
  })
})

describe("loadExternalPlugins", () => {
  it("imports each manifest entry and registers the exported plugin", async () => {
    const register = vi.fn()
    const manifest: ExternalManifest = {
      plugins: [
        { id: "a", url: "/p/a.js" },
        { id: "b", url: "/p/b.js" },
      ],
    }
    const importer = vi.fn(async (url: string) => ({
      default: plugin(url.includes("a") ? "a" : "b"),
    }))

    const loaded = await loadExternalPlugins(manifest, { importer, register })
    expect(importer).toHaveBeenCalledTimes(2)
    expect(register).toHaveBeenCalledTimes(2)
    expect(loaded).toEqual(["a", "b"])
  })

  it("accepts a named `plugin` export as well as default", async () => {
    const register = vi.fn()
    const importer = vi.fn(async () => ({ plugin: plugin("named") }))
    const loaded = await loadExternalPlugins(
      { plugins: [{ id: "named", url: "/x.js" }] },
      { importer, register },
    )
    expect(register).toHaveBeenCalledOnce()
    expect(loaded).toEqual(["named"])
  })

  it("skips entries that fail to import without aborting the rest", async () => {
    const register = vi.fn()
    const importer = vi.fn(async (url: string) => {
      if (url.includes("bad")) throw new Error("boom")
      return { default: plugin("ok") }
    })
    const loaded = await loadExternalPlugins(
      {
        plugins: [
          { id: "bad", url: "/bad.js" },
          { id: "ok", url: "/ok.js" },
        ],
      },
      { importer, register },
    )
    expect(register).toHaveBeenCalledOnce()
    expect(loaded).toEqual(["ok"])
  })

  it("skips modules with no plugin export", async () => {
    const register = vi.fn()
    const importer = vi.fn(async () => ({}))
    const loaded = await loadExternalPlugins(
      { plugins: [{ id: "empty", url: "/e.js" }] },
      { importer, register },
    )
    expect(register).not.toHaveBeenCalled()
    expect(loaded).toEqual([])
  })
})
