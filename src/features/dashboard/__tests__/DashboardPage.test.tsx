import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { UnifiedTask } from "~/platform/contracts/task"
import type { Favorite } from "~/plugins/builtin/favorites/data"

// ~/hooks pulls in hope-ui (CJS scroll-lock) which vitest cannot load; swap in
// a translator backed by the real English dictionary instead.
const h = vi.hoisted(() => ({
  to: vi.fn(),
  admin: { v: false },
  openErrors: vi.fn(),
  setTasks: (_: UnifiedTask[]) => {},
  setLoaded: (_: boolean) => {},
  setRecords: (_: unknown[]) => {},
}))
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
    useRouter: () => ({ to: h.to }),
  }
})
vi.mock("~/plugins", () => ({
  PluginSlot: (p: { name: string }) => (
    <div data-testid="slot" data-name={p.name} />
  ),
}))
vi.mock("~/store", () => ({ me: () => ({ role: h.admin.v ? 2 : 0 }) }))

vi.mock("../../transfers/service", async () => {
  const { createSignal } = await import("solid-js")
  const [tasks, setTasks] = createSignal<UnifiedTask[]>([])
  const [loaded, setLoaded] = createSignal(true)
  h.setTasks = setTasks
  h.setLoaded = setLoaded
  return { transfers: { tasks, loaded, watch: () => () => {} } }
})
vi.mock("../../notifications/service", async () => {
  const { createSignal } = await import("solid-js")
  const [records, setRecords] = createSignal<unknown[]>([])
  h.setRecords = setRecords
  return {
    errorCenter: { records, unreadCount: () => records().length },
  }
})
vi.mock("../../notifications/state", () => ({
  setErrorCenterOpen: h.openErrors,
}))

const fetchFavorites = vi.fn()
vi.mock("~/plugins/builtin/favorites/api", () => ({
  fetchFavorites: () => fetchFavorites(),
}))

import DashboardPage from "../DashboardPage"

const fav = (i: number): Favorite => ({
  id: i,
  path: `/dir${i}`,
  name: `dir${i}`,
  is_dir: true,
  tag: "",
  created_at: 0,
})
const t = (state: string, stale = false) =>
  ({ id: `${state}${Math.random()}`, state, stale }) as UnifiedTask

beforeEach(() => {
  h.to.mockClear()
  h.openErrors.mockClear()
  h.admin.v = false
  h.setTasks([])
  h.setLoaded(true)
  h.setRecords([])
  fetchFavorites.mockReset()
  fetchFavorites.mockResolvedValue({ code: 200, message: "ok", data: [] })
})

describe("DashboardPage", () => {
  it("shows the transfer counts from the store and opens Transfers", () => {
    h.setTasks([t("running"), t("running", true), t("failed")])
    render(() => <DashboardPage />)
    const card = screen.getByTestId("dashboard-transfers")
    expect(card.textContent).toContain("2")
    expect(card.textContent).toContain("1")
    fireEvent.click(card.querySelector("button")!)
    expect(h.to).toHaveBeenCalledWith("/@transfers")
  })

  it("shows loading before the store has loaded, empty when there are no tasks", () => {
    h.setLoaded(false)
    render(() => <DashboardPage />)
    const card = screen.getByTestId("dashboard-transfers")
    expect(card.querySelector("[data-state=loading]")).toBeTruthy()
    h.setLoaded(true)
    expect(card.querySelector("[data-state=empty]")).toBeTruthy()
  })

  it("lists the latest three errors and opens the error center", () => {
    h.setRecords(
      [1, 2, 3, 4].map((i) => ({
        id: `${i}`,
        message: `boom ${i}`,
        source: "x",
        at: i,
      })),
    )
    render(() => <DashboardPage />)
    const items = screen.getAllByTestId("dashboard-error")
    expect(items.map((e) => e.textContent)).toEqual([
      expect.stringContaining("boom 1"),
      expect.stringContaining("boom 2"),
      expect.stringContaining("boom 3"),
    ])
    expect(screen.getByTestId("dashboard-errors").textContent).toContain(
      "4 unread",
    )
    fireEvent.click(
      screen.getByTestId("dashboard-errors").querySelector("button")!,
    )
    expect(h.openErrors).toHaveBeenCalledWith(true)
  })

  it("shows favorites and jumps to one", async () => {
    fetchFavorites.mockResolvedValue({
      code: 200,
      message: "ok",
      data: [fav(1), fav(2)],
    })
    render(() => <DashboardPage />)
    const rows = await screen.findAllByTestId("dashboard-favorite")
    expect(rows).toHaveLength(2)
    fireEvent.click(rows[0])
    expect(h.to).toHaveBeenCalledWith("/dir1")
  })

  it("shows an error with retry when favorites fail", async () => {
    fetchFavorites.mockResolvedValueOnce({
      code: 500,
      message: "down",
      data: null,
    })
    render(() => <DashboardPage />)
    const card = screen.getByTestId("dashboard-favorites")
    await waitFor(() =>
      expect(card.querySelector("[data-state=error]")).toBeTruthy(),
    )
    fetchFavorites.mockResolvedValueOnce({
      code: 200,
      message: "ok",
      data: [fav(3)],
    })
    fireEvent.click(card.querySelector("[data-state=error] button")!)
    expect(await screen.findAllByTestId("dashboard-favorite")).toHaveLength(1)
  })

  it("shows an empty hint for no favorites", async () => {
    render(() => <DashboardPage />)
    const card = screen.getByTestId("dashboard-favorites")
    await waitFor(() =>
      expect(card.querySelector("[data-state=empty]")).toBeTruthy(),
    )
  })

  it("renders the legacy manage-dashboard slot for admins only", () => {
    const { unmount } = render(() => <DashboardPage />)
    expect(
      screen.getAllByTestId("slot").map((s) => s.getAttribute("data-name")),
    ).toEqual(["dashboard"])
    unmount()
    h.admin.v = true
    render(() => <DashboardPage />)
    expect(
      screen.getAllByTestId("slot").map((s) => s.getAttribute("data-name")),
    ).toEqual(["dashboard", "manage-dashboard"])
  })

  it("has no form controls", () => {
    render(() => <DashboardPage />)
    expect(document.querySelector("input, select, textarea, form")).toBeNull()
  })
})
