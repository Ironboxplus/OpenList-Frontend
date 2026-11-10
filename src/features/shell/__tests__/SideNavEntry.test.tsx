import { render, screen } from "@solidjs/testing-library"
import { createSignal, For } from "solid-js"
import { describe, expect, it, vi } from "vitest"

vi.mock("~/hooks", () => ({
  useRouter: () => ({ to: vi.fn(), pathname: () => "/" }),
}))
vi.mock("../NavBadge", () => ({ NavBadge: () => <span data-badge /> }))

import { SideNavEntry } from "../SideNavEntry"
import { NAV_ITEMS } from "../nav-items"

const item = NAV_ITEMS.find((i) => i.id === "transfers")!

describe("SideNavEntry collapse toggle", () => {
  it("survives expanding and collapsing repeatedly (the same link node must never be mounted twice)", () => {
    const [rail, setRail] = createSignal(false)
    // SideNav renders its rows through <For>, whose array reconciliation is
    // what trips over a node that is both the old and the new branch's child.
    render(() => (
      <For each={[item]}>
        {(i) => (
          <SideNavEntry
            item={i}
            active={false}
            rail={rail()}
            label="Transfers"
          />
        )}
      </For>
    ))
    for (let i = 0; i < 10; i++) {
      setRail(true)
      expect(screen.getByRole("link").getAttribute("aria-label")).toBe(
        "Transfers",
      )
      setRail(false)
      expect(screen.getByRole("link").textContent).toContain("Transfers")
    }
    expect(screen.getAllByRole("link")).toHaveLength(1)
  })
})
