import { render } from "@solidjs/testing-library"
import { Suspense } from "solid-js"
import { describe, expect, it, vi } from "vitest"

const h = vi.hoisted(() => ({
  viewport: undefined as unknown as () => string,
  setViewport: undefined as unknown as (v: string) => void,
  me: undefined as unknown as () => { id?: number; role?: number },
  setMe: undefined as unknown as (u: { id?: number; role?: number }) => void,
  setPaletteOpen: undefined as unknown as (v: boolean) => void,
  // The lazy chrome chunks resolve only when the test releases these.
  release: {} as Record<"task" | "palette", () => void>,
  gate: {} as Record<"task" | "palette", Promise<void>>,
}))
for (const k of ["task", "palette"] as const)
  h.gate[k] = new Promise<void>((r) => (h.release[k] = r))

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
vi.mock("../../palette/state", async () => {
  const { createSignal } = await import("solid-js")
  const [open, setOpen] = createSignal(false)
  h.setPaletteOpen = setOpen
  return {
    isPaletteHotkey: () => false,
    paletteOpen: open,
    setPaletteOpen: setOpen,
  }
})
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
  TopBar: () => <header />,
}))
vi.mock("../../transfers/TaskCenter", async () => {
  await h.gate.task
  return { default: () => <div data-task-center /> }
})
vi.mock("../../notifications/ErrorCenter", () => ({
  default: () => <div data-error-center />,
}))
vi.mock("../../palette/CommandPalette", async () => {
  await h.gate.palette
  return { default: () => <div data-palette /> }
})

import AppShell from "../AppShell"

describe("AppShell content frame", () => {
  it("is never removed or moved when the viewport or sign-in state changes", async () => {
    // Like src/app/index.tsx: a root boundary that blanks the app while it loads.
    const { container } = render(() => (
      <Suspense fallback={<div data-root-fallback />}>
        <AppShell>
          <p>page</p>
        </AppShell>
      </Suspense>
    ))
    const frame = container.querySelector("[data-shell-frame]")!
    expect(frame).toBeTruthy()

    let removals = 0
    let fallbacks = 0
    const count = (records: MutationRecord[]) => {
      for (const r of records) {
        for (const n of r.removedNodes) if (n === frame) removals++
        for (const n of r.addedNodes)
          if ((n as Element).hasAttribute?.("data-root-fallback")) fallbacks++
      }
    }
    const observer = new MutationObserver(count)
    observer.observe(container, { childList: true, subtree: true })

    // Chrome that has never been loaded mounts while its chunk is still loading.
    h.setMe({ id: 1, role: 0 })
    h.setViewport("tablet")
    h.setPaletteOpen(true)
    await new Promise((r) => setTimeout(r, 20))
    h.release.task()
    h.release.palette()
    await new Promise((r) => setTimeout(r, 20))
    expect(container.querySelector("[data-task-center]")).toBeTruthy()
    expect(container.querySelector("[data-palette]")).toBeTruthy()

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

    expect(fallbacks).toBe(0)
    expect(removals).toBe(0)
    expect(frame.isConnected).toBe(true)
    expect(container.querySelector("[data-shell-frame]")).toBe(frame)
  })
})
