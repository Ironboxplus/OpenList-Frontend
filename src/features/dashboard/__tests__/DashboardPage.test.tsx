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
  return {
    transfers: {
      tasks,
      loaded,
      watch: () => () => {},
      history: () => [],
      loadHistory: async () => {},
    },
  }
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

const getStatsOverview = vi.fn()
vi.mock("~/platform/api/stats", () => ({
  getStatsOverview: (...a: unknown[]) => getStatsOverview(...a),
}))
// The chart pulls in echarts (canvas); the cards are what is under test.
vi.mock("../TrafficChart", () => ({
  default: (p: { kind: string }) => <div data-testid={`chart-${p.kind}`} />,
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

const counts = (d: number, u: number, cd = 0, cu = 0) => ({
  server_download: d,
  server_upload: u,
  client_download: cd,
  client_upload: cu,
})
const overview = () => ({
  node: "cfscan",
  traffic: {
    now_bps: counts(8 * 1048576, 1048576),
    series: [{ t: 1, ...counts(1, 1) }],
    today: counts(3 * 1073741824, 0, 2048, 0),
    month: counts(5 * 1073741824, 1073741824),
    total: counts(1099511627776, 536870912),
    daily: [{ day: "2026-10-13", ...counts(1, 1) }],
  },
  media: {
    movie: 120,
    tv: 45,
    anime: 80,
    collection: 6,
    episodes: 3210,
    unscraped: 12,
  },
})

beforeEach(() => {
  h.to.mockClear()
  h.openErrors.mockClear()
  h.admin.v = false
  h.setTasks([])
  h.setLoaded(true)
  h.setRecords([])
  getStatsOverview.mockReset()
  getStatsOverview.mockResolvedValue({ ok: true, data: overview() })
  fetchFavorites.mockReset()
  fetchFavorites.mockResolvedValue({ code: 200, message: "ok", data: [] })
})

describe("DashboardPage", () => {
  it("shows the transfer counts from the store and opens Transfers", () => {
    h.setTasks([t("running"), t("running", true), t("failed")])
    render(() => <DashboardPage />)
    const card = screen.getByTestId("dashboard-transfers")
    // two in progress; the failed one has no end time, so it is not "today"
    expect(card.textContent).toContain("2In progress")
    expect(card.textContent).toContain("0Done today")
    expect(card.textContent).toContain("0Failed today")
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

  it("an admin gets the traffic, speed, library and sync cards from the overview", async () => {
    h.admin.v = true
    render(() => <DashboardPage />)
    const traffic = await screen.findByTestId("dashboard-traffic")
    await waitFor(() => expect(traffic.textContent).toContain("3.00G"))
    const today = traffic.querySelector("[data-period=today]")!
    expect(today.textContent).toContain("3.00G")
    expect(today.textContent).toContain("0B") // nothing uploaded today
    expect(today.textContent).toContain("2.00K") // client side, shown apart
    expect(traffic.querySelector("[data-period=total]")!.textContent).toContain(
      "1.00T",
    )
    expect(traffic.textContent).toContain("cfscan")
    expect(screen.getByTestId("dashboard-speed").textContent).toContain(
      "8.00M/s",
    )
    expect(await screen.findByTestId("chart-speed")).toBeTruthy()
    expect(await screen.findByTestId("chart-daily")).toBeTruthy()
    const media = screen.getByTestId("dashboard-media")
    expect(media.querySelector("[data-media=episodes]")!.textContent).toContain(
      "3,210",
    )
    expect(
      media.querySelector("[data-media=unscraped]")!.textContent,
    ).toContain("12")
    expect(screen.getByTestId("dashboard-sync")).toBeTruthy()
    fireEvent.click(media.querySelector("button")!)
    expect(h.to).toHaveBeenCalledWith("/@media")
  })

  it("a failed overview shows a retry inside its cards only", async () => {
    h.admin.v = true
    getStatsOverview.mockResolvedValueOnce({
      ok: false,
      error: { message: "stats down" },
    })
    render(() => <DashboardPage />)
    const traffic = await screen.findByTestId("dashboard-traffic")
    await waitFor(() =>
      expect(traffic.querySelector("[data-state=error]")).toBeTruthy(),
    )
    expect(traffic.textContent).toContain("stats down")
    // the other cards are not affected
    expect(screen.getByTestId("dashboard-transfers")).toBeTruthy()
    await new Promise((r) => setTimeout(r, 0)) // let the failed round settle
    fireEvent.click(traffic.querySelector("[data-state=error] button")!)
    await waitFor(() => expect(traffic.textContent).toContain("3.00G"))
  })

  it("a signed-in non-admin sees neither the traffic nor the library cards, and asks for nothing", () => {
    render(() => <DashboardPage />)
    for (const id of [
      "dashboard-traffic",
      "dashboard-speed",
      "dashboard-daily",
      "dashboard-media",
      "dashboard-sync",
    ]) {
      expect(screen.queryByTestId(id)).toBeNull()
    }
    expect(screen.getByTestId("dashboard-transfers")).toBeTruthy()
    expect(screen.getByTestId("dashboard-errors")).toBeTruthy()
    expect(screen.getByTestId("dashboard-favorites")).toBeTruthy()
    expect(getStatsOverview).not.toHaveBeenCalled()
  })

  it("has no form controls", () => {
    render(() => <DashboardPage />)
    expect(document.querySelector("input, select, textarea, form")).toBeNull()
  })
})
