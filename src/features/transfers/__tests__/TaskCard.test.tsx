import { fireEvent, render, screen } from "@solidjs/testing-library"
import { describe, expect, it, vi } from "vitest"
import type { SyncSnapshot, UnifiedTask } from "~/platform/contracts/task"
import { mapSyncSnapshot, mapTache, type TacheRaw } from "../adapter"
import { TaskCard } from "../TaskCard"

// ~/hooks pulls in hope-ui (CJS scroll-lock) which vitest cannot load; swap in
// a translator backed by the real English dictionary instead.
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
  }
})

const NOW = new Date("2026-10-08T10:00:00Z")

const raw = (over: Partial<TacheRaw> = {}): TacheRaw => ({
  id: "t1",
  name: "copy [/a](/dir/x.mkv) to [/b](/out)",
  creator: "admin",
  creator_role: 2,
  state: 1,
  status: "copying",
  progress: 40,
  start_time: "2026-10-08T09:59:00Z",
  end_time: null,
  total_bytes: 1048576,
  error: "",
  ...over,
})

const tache = (over: Partial<TacheRaw>, done = false): UnifiedTask =>
  mapTache(raw(over), "copy", done, NOW)

const snap = (over: Partial<SyncSnapshot> = {}): SyncSnapshot => ({
  id: "s1",
  spec: {
    mode: "copy",
    src: "local:/tmp/a",
    dst: "/local",
    dry_run: false,
    size_only: false,
    track_renames: false,
    resync: false,
    force: false,
    filters: [],
    transfers: 4,
    checkers: 8,
  },
  state: "running",
  started_at: "2026-10-08T09:00:00Z",
  counters: {
    match: 7,
    differ: 0,
    only_in_src: 0,
    only_in_dst: 0,
    errors: 2,
    uploaded: 5,
    uploaded_bytes: 2048,
    rapid_uploads: 3,
    rapid_bytes: 3 * 1048576,
  },
  stats: { bytes: 1024, totalBytes: 4096 },
  ...over,
})

describe("TaskCard", () => {
  it("shows a determinate bar when percent is known", () => {
    render(() => <TaskCard task={tache({ progress: 40 })} />)
    const bar = screen.getByRole("progressbar")
    expect(bar.getAttribute("aria-valuenow")).toBe("40")
    expect(bar.hasAttribute("data-indeterminate")).toBe(false)
  })

  it("shows an indeterminate bar for running with unknown progress", () => {
    render(() => <TaskCard task={tache({ progress: 100, state: 1 })} />)
    const bar = screen.getByRole("progressbar")
    expect(bar.getAttribute("aria-valuenow")).toBeNull()
    expect(bar.hasAttribute("data-indeterminate")).toBe(true)
  })

  it("shows no bar for a finished task that has no percent", () => {
    render(() => (
      <TaskCard
        task={mapSyncSnapshot(
          snap({ state: "canceled", stats: undefined }),
          NOW,
        )}
      />
    ))
    expect(screen.queryByRole("progressbar")).toBeNull()
  })

  it("shows the title as source and destination", () => {
    render(() => <TaskCard task={tache({})} />)
    const title = screen.getByTestId("task-title")
    expect(title.textContent).toContain("/a/dir/x.mkv")
    expect(title.textContent).toContain("/b/out")
  })

  it("failed + retryable: error summary, retry and delete buttons", () => {
    const onAction = vi.fn()
    const task = tache({ state: 7, error: "no space left", progress: 10 }, true)
    render(() => <TaskCard task={task} onAction={onAction} />)
    expect(screen.getByTestId("task-error").textContent).toBe("no space left")
    expect(screen.getByTestId("task-card").getAttribute("data-state")).toBe(
      "failed",
    )

    fireEvent.click(document.querySelector('[data-action="retry"]')!)
    expect(onAction).toHaveBeenCalledWith(task, "retry")
  })

  it("expands the error text on click", () => {
    const task = tache({ state: 7, error: "long error" }, true)
    render(() => <TaskCard task={task} />)
    const err = screen.getByTestId("task-error")
    expect(err.className).toContain("line-clamp-2")
    fireEvent.click(err)
    expect(err.className).not.toContain("line-clamp-2")
  })

  it("deleting asks for confirmation first", async () => {
    const onAction = vi.fn()
    const task = tache({ state: 2, progress: 100 }, true)
    render(() => <TaskCard task={task} onAction={onAction} />)
    fireEvent.click(document.querySelector('[data-action="delete"]')!)
    expect(onAction).not.toHaveBeenCalled()
    fireEvent.click(await screen.findByTestId("confirm-delete"))
    expect(onAction).toHaveBeenCalledWith(task, "delete")
  })

  it("running tasks offer cancel only", () => {
    render(() => <TaskCard task={tache({})} />)
    const actions = [...document.querySelectorAll("[data-action]")].map((b) =>
      b.getAttribute("data-action"),
    )
    expect(actions).toEqual(["cancel"])
  })

  it("sync card shows rapid / uploaded / unchanged / error counts", () => {
    const task = mapSyncSnapshot(snap(), NOW)
    render(() => <TaskCard task={task} />)
    const counts = screen.getByTestId("sync-counts").textContent!
    expect(counts).toContain("Instant 3")
    expect(counts).toContain("3.00 MiB saved")
    // 5 uploaded minus 3 instant = 2 actually transferred
    expect(counts).toContain("Uploaded 2")
    expect(counts).toContain("2.00 KiB")
    expect(counts).toContain("Unchanged 7")
    expect(counts).toContain("Errors 2")
  })

  it("running sync shows transferred-so-far instead of a percentage", () => {
    render(() => <TaskCard task={mapSyncSnapshot(snap(), NOW)} />)
    expect(screen.getByTestId("task-meta").textContent).toContain(
      "Transferred 1.00 KiB of 4.00 KiB found so far",
    )
    expect(
      screen.getByRole("progressbar").hasAttribute("data-indeterminate"),
    ).toBe(true)
  })

  it("a checking sync says so instead of showing 0 B / 0 files", () => {
    const task = mapSyncSnapshot(
      snap({
        stats: {
          checks: 3133,
          totalChecks: 3133,
          listed: 7290,
          transfers: 0,
          totalTransfers: 0,
          bytes: 0,
          totalBytes: 0,
        },
      }),
      NOW,
    )
    render(() => <TaskCard task={task} />)
    const meta = screen.getByTestId("task-meta").textContent!
    expect(meta).toBe("Checking · 3133 checked · 7290 scanned")
    expect(meta).not.toContain("0 B")
    expect(meta).not.toContain("files")
    expect(
      screen.getByRole("progressbar").hasAttribute("data-indeterminate"),
    ).toBe(true)
  })

  it("compact cards drop the stats and buttons", () => {
    render(() => <TaskCard task={tache({})} compact />)
    expect(screen.queryByTestId("task-meta")).toBeNull()
    expect(document.querySelector("[data-action]")).toBeNull()
  })
})

describe("TaskCard open-folder buttons", () => {
  it("offers source and destination and reports where they lead", () => {
    const open = vi.fn()
    render(() => <TaskCard task={tache({})} onOpenPath={open} />)
    fireEvent.click(document.querySelector('[data-action="open_source"]')!)
    expect(open).toHaveBeenLastCalledWith({ dir: "/a/dir", highlight: "x.mkv" })
    fireEvent.click(document.querySelector('[data-action="open_destination"]')!)
    expect(open).toHaveBeenLastCalledWith({ dir: "/b/out", highlight: "x.mkv" })
  })

  it("has none without a handler or in the compact drawer", () => {
    const { unmount } = render(() => <TaskCard task={tache({})} />)
    expect(document.querySelector('[data-action="open_source"]')).toBeNull()
    unmount()
    render(() => <TaskCard task={tache({})} compact onOpenPath={vi.fn()} />)
    expect(document.querySelector('[data-action="open_source"]')).toBeNull()
  })

  it("a sync job hides the local: end and opens the tree end", () => {
    render(() => (
      <TaskCard task={mapSyncSnapshot(snap(), NOW)} onOpenPath={vi.fn()} />
    ))
    expect(document.querySelector('[data-action="open_source"]')).toBeNull()
    expect(
      document.querySelector('[data-action="open_destination"]'),
    ).not.toBeNull()
  })
})

describe("TaskCard: pack stages", () => {
  const snap = (over: Partial<SyncSnapshot>): UnifiedTask =>
    mapSyncSnapshot(
      {
        id: "p1",
        spec: {
          mode: "copy",
          src: "local:/a",
          dst: "/b",
          dry_run: false,
          size_only: false,
          track_renames: false,
          resync: false,
          force: false,
          filters: [],
          transfers: 0,
          checkers: 0,
        },
        state: "running",
        started_at: "2026-10-08T09:59:00Z",
        counters: {
          match: 0,
          differ: 0,
          only_in_src: 0,
          only_in_dst: 0,
          errors: 0,
          uploaded: 0,
          uploaded_bytes: 0,
          rapid_uploads: 0,
          rapid_bytes: 0,
        },
        ...over,
      },
      NOW,
    )

  it("says packing, with files and packs so far, while that stage runs", () => {
    render(() => (
      <TaskCard
        task={snap({
          stage: "packing",
          pack_stats: {
            packed_files: 120,
            packs: 3,
            bytes_in: 10,
            bytes_out: 5,
            dead_removed: 0,
          },
        })}
      />
    ))
    expect(screen.getByTestId("task-meta").textContent).toBe(
      "Packing · 120 files into 3 packs",
    )
  })

  it("says unpacking while that stage runs", () => {
    render(() => (
      <TaskCard
        task={snap({
          stage: "unpacking",
          pack_stats: {
            packed_files: 0,
            packs: 0,
            bytes_in: 0,
            bytes_out: 0,
            dead_removed: 0,
            unpacked_files: 42,
          },
        })}
      />
    ))
    expect(screen.getByTestId("task-meta").textContent).toBe(
      "Unpacking · 42 files",
    )
  })
})
