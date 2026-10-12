import { beforeEach, describe, expect, it, vi } from "vitest"
vi.mock("~/hooks", async (orig) =>
  (await import("./mocks")).hooksMock(await orig()),
)
vi.mock("~/utils/notify", async () => (await import("./mocks")).notifyMock())

import IndexPage from "../indexes/index_page"
import {
  buttonByText,
  clickButton,
  confirmIfAsked,
  expectGolden,
  mockApi,
  renderPage,
  settle,
  setValue,
  writes,
} from "./harness"
import { resetRouter } from "./mocks"

beforeEach(() => {
  resetRouter()
  mockApi({
    "GET /admin/setting/list": () => [],
    "GET /admin/index/progress": () => ({
      obj_count: 42,
      is_done: true,
      last_done_time: "2026-01-01T00:00:00Z",
      error: "boom",
    }),
    "GET /admin/scan/progress": () => ({ obj_count: 7, is_done: false }),
    "POST /admin/index/build": () => null,
    "POST /admin/index/update": () => null,
    "POST /admin/index/clear": () => null,
    "POST /admin/index/stop": () => null,
    "POST /admin/scan/start": () => null,
    "POST /admin/scan/stop": () => null,
  })
})

describe("indexes and scan", () => {
  it("shows progress, including the error text in full", async () => {
    renderPage(() => <IndexPage />)
    await settle()
    expect(document.body.textContent).toContain("42")
    expect(document.body.textContent).toContain("boom")
  })

  it("rebuild / clear / stop / update post their documented bodies", async () => {
    renderPage(() => <IndexPage />)
    await settle()
    await clickButton("Rebuild indexes")
    await clickButton("Clear")
    await confirmIfAsked()
    // two "Stop" buttons exist (index, scan): the first belongs to the index
    const stops = [...document.querySelectorAll("button")].filter(
      (b) => b.textContent?.trim() === "Stop",
    )
    stops[0].click()
    await settle()
    // update dialog
    const updates = [...document.querySelectorAll("button")].filter(
      (b) => b.textContent?.trim() === "Update indexes",
    )
    updates[0].click()
    await settle()
    const boxes = document.querySelectorAll("textarea")
    setValue(boxes[boxes.length - 1], "/a\n/b")
    const depth = [...document.querySelectorAll("input[type=number]")].pop()!
    setValue(depth, "3")
    const inner = [...document.querySelectorAll("button")].filter(
      (b) => b.textContent?.trim() === "Update indexes",
    )
    inner[inner.length - 1].click()
    await settle()
    expectGolden(
      "indexes-writes",
      writes().map((c) => [c.path, c.body ?? null]),
    )
  })

  it("scan: start sends path and rate limit, stop is enabled while running", async () => {
    renderPage(() => <IndexPage />)
    await settle()
    const rate = [...document.querySelectorAll("input[type=number]")].pop()!
    setValue(rate, "0.5")
    await clickButton("Start")
    const stops = [...document.querySelectorAll("button")].filter(
      (b) => b.textContent?.trim() === "Stop",
    )
    expect(stops[stops.length - 1].disabled).toBe(false)
    stops[stops.length - 1].click()
    await settle()
    expectGolden(
      "scan-writes",
      writes().map((c) => [c.path, c.body ?? null]),
    )
    expect(buttonByText("Start")).toBeTruthy()
  })
})
