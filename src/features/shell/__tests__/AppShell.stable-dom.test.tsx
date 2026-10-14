import { render } from "@solidjs/testing-library"
import { createSignal } from "solid-js"
import { describe, expect, it, vi } from "vitest"

const h = vi.hoisted(() => ({
  viewport: undefined as unknown as () => string,
  setViewport: undefined as unknown as (v: string) => void,
  me: undefined as unknown as () => { id?: number; role?: number },
  setMe: undefined as unknown as (u: { id?: number; role?: number }) => void,
}))

vi.mock("@hope-ui/solid", () => ({
  useColorMode: () => ({ colorMode: () => "light" }),
}))
vi.mock("solid-motionone", () => ({
  Motion: { div: (p: any) => <div>{p.children}</div> },
}))
vi.mock("~/components", () => ({ FullLoading: () => <span /> }))
vi.mock("~/hooks", () => ({
  useRouter: () => ({ pathname: () => "/@manage" }),
}))
vi.mock("~/utils/motion-presets", () => ({
  asMotion: (x: unknown) => x,
  motionProps: (x: unknown) => x,
  sectionEnter: {},
}))
vi.mock("~/store", async () => {
  const { createSignal } = await import("solid-js")
  const [me, setMe] = createSignal<{ id?: number; role?: number }>({})
  h.me = me
  h.setMe = setMe
  return { me }
})
vi.mock("../viewport", async () => {
  const { createSignal } = await import("solid-js")
  const [vp, setVp] = createSignal("phone")
  h.viewport = vp
  h.setViewport = setVp
  return { createViewport: () => vp }
})
vi.mock("../../palette/state", () => ({
  isPaletteHotkey: () => false,
  paletteOpen: () => true,
  setPaletteOpen: vi.fn(),
}))
vi.mock("../../transfers/service", () => ({ transfers: {} }))
vi.mock("../transfers-lifecycle", () => ({ bindTransfersToUser: vi.fn() }))
vi.mock("../nav-items", () => ({
  activeNavId: () => "settings",
  preloadAllSections: () => () => {},
  readCollapsed: () => false,
  writeCollapsed: vi.fn(),
}))
vi.mock("../SideNav", () => ({
  FULL_WIDTH: "1rem",
  RAIL_WIDTH: "1rem",
  SideNav: () => <nav data-side-nav />,
}))
vi.mock("../BottomTabs", () => ({
  TAB_BAR_HEIGHT: "1rem",
  BottomTabs: () => <div data-bottom-tabs />,
}))
vi.mock("../TopBar", () => ({
  TOP_BAR_HEIGHT: "1rem",
  TopBar: () => <header />,
}))
vi.mock("../../transfers/TaskCenter", () => ({
  default: () => <div data-task-center />,
}))
vi.mock("../../notifications/ErrorCenter", () => ({
  default: () => <div data-error-center />,
}))
vi.mock("../../palette/CommandPalette", () => ({
  default: () => <div data-palette />,
}))

import AppShell from "../AppShell"

describe("AppShell content frame", () => {
  it("is never removed or moved when the viewport or sign-in state changes", async () => {
    const { container } = render(() => (
      <AppShell>
        <p>page</p>
      </AppShell>
    ))
    const frame = container.querySelector("[data-shell-frame]")!
    expect(frame).toBeTruthy()

    let removals = 0
    const count = (records: MutationRecord[]) => {
      for (const r of records)
        for (const n of r.removedNodes) if (n === frame) removals++
    }
    const observer = new MutationObserver(count)
    observer.observe(container, { childList: true, subtree: true })

    const steps: [string, boolean][] = [
      ["phone", true],
      ["tablet", true],
      ["desktop", true],
      ["phone", true],
      ["tablet", false],
      ["phone", true],
      ["desktop", false],
      ["phone", true],
    ]
    for (const [vp, signedIn] of steps) {
      h.setViewport(vp)
      h.setMe(signedIn ? { id: 1, role: 0 } : { id: 2, role: 2 })
      await Promise.resolve()
    }
    count(observer.takeRecords())
    observer.disconnect()

    expect(removals).toBe(0)
    expect(frame.isConnected).toBe(true)
    expect(container.querySelector("[data-shell-frame]")).toBe(frame)
  })
})
