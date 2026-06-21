import { describe, it, expect } from "vitest"
import type { Component } from "solid-js"
import { selectSlot, type Plugin } from "../registry"

// Lightweight stand-ins for real components; selectSlot never renders them.
const A: Component = () => null
const B: Component = () => null
const C: Component = () => null

function plugin(
  id: string,
  contributions: Plugin["contributions"],
  enabled?: boolean,
): Plugin {
  return { id, enabled, contributions }
}

describe("selectSlot", () => {
  it("returns components contributed to the requested slot", () => {
    const plugins = [
      plugin("p1", [{ slot: "header-right", component: A }]),
      plugin("p2", [{ slot: "toolbar-right", component: B }]),
    ]
    const result = selectSlot(plugins, "header-right")
    expect(result).toHaveLength(1)
    expect(result[0].pluginId).toBe("p1")
    expect(result[0].component).toBe(A)
  })

  it("orders contributions by their order field (default 0)", () => {
    const plugins = [
      plugin("late", [{ slot: "header-right", component: A, order: 10 }]),
      plugin("early", [{ slot: "header-right", component: B, order: -5 }]),
      plugin("mid", [{ slot: "header-right", component: C }]),
    ]
    const ids = selectSlot(plugins, "header-right").map((c) => c.pluginId)
    expect(ids).toEqual(["early", "mid", "late"])
  })

  it("skips disabled plugins (enabled === false)", () => {
    const plugins = [
      plugin("on", [{ slot: "header-right", component: A }]),
      plugin("off", [{ slot: "header-right", component: B }], false),
    ]
    const ids = selectSlot(plugins, "header-right").map((c) => c.pluginId)
    expect(ids).toEqual(["on"])
  })

  it("treats undefined enabled as enabled", () => {
    const plugins = [plugin("p", [{ slot: "header-right", component: A }])]
    expect(selectSlot(plugins, "header-right")).toHaveLength(1)
  })

  it("supports a single plugin contributing to multiple slots", () => {
    const plugins = [
      plugin("multi", [
        { slot: "header-right", component: A },
        { slot: "footer", component: B },
      ]),
    ]
    expect(selectSlot(plugins, "header-right")[0].component).toBe(A)
    expect(selectSlot(plugins, "footer")[0].component).toBe(B)
  })

  it("returns an empty array for an unknown slot", () => {
    const plugins = [plugin("p1", [{ slot: "header-right", component: A }])]
    expect(selectSlot(plugins, "nope")).toEqual([])
  })
})
