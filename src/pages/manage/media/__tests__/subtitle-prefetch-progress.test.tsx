import { render, screen, waitFor } from "@solidjs/testing-library"
import { afterEach, describe, expect, it, vi } from "vitest"

const { progress } = vi.hoisted(() => ({ progress: vi.fn() }))
vi.mock("~/utils/media_api", () => ({
  adminSubtitlePrefetchProgress: progress,
}))
vi.mock("~/hooks", () => ({
  useT: () => (key: string, vars?: Record<string, unknown>) =>
    vars ? `${key} ${JSON.stringify(vars)}` : key,
}))

import { SubtitlePrefetchProgress } from "../SubtitlePrefetchProgress"

const answer = (data: Record<string, unknown>) =>
  progress.mockResolvedValue({
    code: 200,
    data: {
      enabled: true,
      running: false,
      files: 0,
      total: 0,
      tracks: 0,
      current: "",
      failed: 0,
      error: "",
      ...data,
    },
  })

describe("SubtitlePrefetchProgress", () => {
  afterEach(() => {
    document.body.innerHTML = ""
    progress.mockReset()
  })

  it("shows how many files of how many have been looked at", async () => {
    answer({
      running: true,
      files: 12,
      total: 340,
      tracks: 31,
      current: "/a/b.mkv",
    })
    render(() => <SubtitlePrefetchProgress />)
    await waitFor(() =>
      expect(screen.getByTestId("prefetch").textContent).toContain(
        '{"files":12,"total":340,"tracks":31}',
      ),
    )
    expect(screen.getByTestId("prefetch").textContent).toContain("/a/b.mkv")
  })

  it("says it is off when the setting is", async () => {
    answer({ enabled: false })
    render(() => <SubtitlePrefetchProgress />)
    await waitFor(() =>
      expect(screen.getByTestId("prefetch").textContent).toContain(
        "manage.media_lib.prefetch_idle",
      ),
    )
  })

  it("reports failures, and a progress request that failed", async () => {
    answer({ total: 5, files: 5, failed: 2, error: "boom" })
    const view = render(() => <SubtitlePrefetchProgress />)
    await waitFor(() =>
      expect(view.container.textContent).toContain('"count":2,"error":"boom"'),
    )
    document.body.innerHTML = ""
    progress.mockResolvedValue({ code: 500, message: "x" })
    render(() => <SubtitlePrefetchProgress />)
    await waitFor(() =>
      expect(screen.getByTestId("prefetch").textContent).toContain(
        "manage.media_lib.prefetch_load_failed",
      ),
    )
  })
})
