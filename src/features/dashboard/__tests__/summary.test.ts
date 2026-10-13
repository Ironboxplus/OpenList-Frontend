import { describe, expect, it } from "vitest"
import type { TaskState, UnifiedTask } from "~/platform/contracts/task"
import type { Favorite } from "~/plugins/builtin/favorites/data"
import type { ErrorRecord } from "../../notifications/store"
import {
  dashboardSlots,
  recentErrors,
  summarizeTransfers,
  topFavorites,
} from "../summary"

const task = (state: TaskState, stale?: boolean): UnifiedTask =>
  ({ id: `${state}-${stale}`, state, stale }) as UnifiedTask

describe("summarizeTransfers", () => {
  it("counts in-progress, failed and stale tasks", () => {
    const s = summarizeTransfers([
      task("running"),
      task("running", true),
      task("queued"),
      task("waiting_retry"),
      task("failed"),
      task("succeeded"),
      task("canceled"),
    ])
    expect(s).toEqual({ active: 4, failed: 1, stale: 1 })
  })
  it("is all zeros for no tasks", () => {
    expect(summarizeTransfers([])).toEqual({ active: 0, failed: 0, stale: 0 })
  })
})

describe("recentErrors", () => {
  const rec = (i: number) => ({ id: String(i) }) as ErrorRecord
  it("keeps the first three (the list is newest first)", () => {
    const all = [1, 2, 3, 4, 5].map(rec)
    expect(recentErrors(all).map((r) => r.id)).toEqual(["1", "2", "3"])
  })
  it("returns what there is when fewer", () => {
    expect(recentErrors([rec(1)])).toHaveLength(1)
  })
})

describe("topFavorites", () => {
  const fav = (i: number, is_dir: boolean): Favorite => ({
    id: i,
    path: `/f${i}`,
    name: `f${String(i).padStart(2, "0")}`,
    is_dir,
    tag: "",
    created_at: 0,
  })
  it("takes eight, folders first, by name", () => {
    const all = [
      ...Array.from({ length: 6 }, (_, i) => fav(i, false)),
      ...Array.from({ length: 6 }, (_, i) => fav(10 + i, true)),
    ]
    const top = topFavorites(all)
    expect(top).toHaveLength(8)
    expect(top.slice(0, 6).every((f) => f.is_dir)).toBe(true)
  })
})

describe("dashboardSlots", () => {
  it("gives the legacy admin slot to admins only", () => {
    expect(dashboardSlots(true)).toEqual(["dashboard", "manage-dashboard"])
    expect(dashboardSlots(false)).toEqual(["dashboard"])
  })
})
