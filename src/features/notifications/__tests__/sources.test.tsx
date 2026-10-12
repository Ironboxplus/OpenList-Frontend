// The three things that feed the error center, each through the real entry
// point: a failed response (handleResp), a failed task (the transfers store),
// and a storage that did not load (StorageLoadingBar).
import { render } from "@solidjs/testing-library"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { taskFailureInput } from "~/features/transfers/adapter"
import {
  createTransfersStore,
  type StoreDeps,
} from "~/features/transfers/store"
import { mockApi, settle } from "~/pages/manage/__tests__/harness"
import { handleResp } from "~/utils/handle_resp"
import { errorCenter } from "../service"
import type { Resp } from "~/types"

vi.mock("~/hooks", async () => {
  const i18n = await import("@solid-primitives/i18n")
  const { dict } = await import("~/lang/en/entry")
  const flat = i18n.flatten(dict) as Record<string, string>
  const useT =
    () => (key: string, params?: Record<string, string | number>) => {
      const tpl = flat[key]
      if (typeof tpl !== "string") return key
      return params ? i18n.resolveTemplate(tpl, params) : tpl
    }
  return { useT }
})
vi.mock("~/hooks/useT", async () => {
  const { useT } = await import("~/hooks")
  return { useT }
})
vi.mock("~/utils/notify", () => ({
  notify: { error: vi.fn(), success: vi.fn() },
}))

const fail = (over: Partial<Resp<null>>): Resp<null> => ({
  code: 500,
  message: "backend said no",
  data: null,
  ...over,
})

beforeEach(() => errorCenter.clear())

describe("source 1: failed responses (handleResp)", () => {
  it("records a server failure with the request path and category", () => {
    handleResp(
      fail({ code: 403, transport: "permission", source: "/fs/remove" }),
    )
    const [rec] = errorCenter.records()
    expect(rec).toMatchObject({
      category: "permission",
      source: "/fs/remove",
      message: "backend said no",
    })
    expect(rec.detail).toContain("code 403")
  })

  it('classifies a business failure by its code and falls back to "api"', () => {
    handleResp(fail({ code: 500 }))
    expect(errorCenter.records()[0]).toMatchObject({
      category: "internal",
      source: "api",
    })
  })

  it("does not record 401 (the login flow owns it)", () => {
    handleResp(fail({ code: 401, transport: "auth" }))
    handleResp(fail({ code: 401 }))
    expect(errorCenter.records()).toHaveLength(0)
  })

  it("does not record a canceled request", () => {
    handleResp(fail({ code: -1, transport: "canceled", message: "canceled" }))
    expect(errorCenter.records()).toHaveLength(0)
  })

  it("does not record failures the caller asked to keep quiet, or successes", () => {
    handleResp(fail({}), undefined, undefined, true, false)
    handleResp({ code: 200, message: "ok", data: null })
    expect(errorCenter.records()).toHaveLength(0)
  })
})

describe("source 2: failed tasks (transfers store)", () => {
  const ok = <T,>(data: T) =>
    Promise.resolve({ code: 200, message: "ok", data })
  const raw = (over = {}) => ({
    id: "9",
    name: "copy [/a](/x) to [/b](/)",
    creator: "u",
    creator_role: 0,
    state: 7,
    status: "",
    progress: 10,
    start_time: "2026-10-08T09:59:00Z",
    end_time: "2026-10-08T09:59:30Z",
    total_bytes: 0,
    error: "no space left",
    ...over,
  })
  const store = (list: unknown[], seen: string[] = []) => {
    const deps: StoreDeps = {
      fetchTache: ((type: string, done: boolean) =>
        ok(type === "copy" && done ? list : [])) as any,
      postTache: (() => ok(null)) as any,
      fetchSyncList: (() => ok([])) as any,
      fetchSyncHistory: (() => ok([])) as any,
      fetchSyncJob: (() => ok(null)) as any,
      cancelSync: (() => ok(null)) as any,
      isAdmin: () => false,
      isHidden: () => false,
      notifyError: vi.fn(),
      info: vi.fn(),
      now: () => new Date("2026-10-08T10:00:00Z"),
      storage: {
        getItem: (k) =>
          k === "transfers-seen-failed" ? JSON.stringify(seen) : null,
        setItem: () => {},
      },
      onFailed: (t) => errorCenter.record(taskFailureInput(t)),
    }
    return createTransfersStore(deps)
  }

  it("records a task that failed, once, pointing at its detail", async () => {
    const s = store([raw()])
    await s.refresh()
    await s.refresh()
    const recs = errorCenter.records()
    expect(recs).toHaveLength(1)
    expect(recs[0]).toMatchObject({
      category: "task",
      message: "no space left",
      taskId: "copy:9",
      href: "/@transfers?task=copy%3A9",
    })
    s.dispose()
  })

  it("skips failures the user has already seen and old history", async () => {
    const seen = store([raw()], ["copy:9"])
    await seen.refresh()
    const old = store([raw({ id: "8", end_time: "2026-10-08T08:00:00Z" })])
    await old.refresh()
    expect(errorCenter.records()).toHaveLength(0)
    seen.dispose()
    old.dispose()
  })
})

describe("source 3: storages that failed to load (StorageLoadingBar)", () => {
  it("records each failed storage once across polls", async () => {
    mockApi({
      "GET /admin/storage/loading": () => ({
        total: 2,
        pending: 0,
        loading: 1,
        loaded: 0,
        failed: 1,
        finished: false,
        items: [
          {
            mount_path: "/dav",
            driver: "WebDav",
            state: "failed",
            error: "401 from remote",
          },
          { mount_path: "/ok", driver: "Local", state: "loading" },
        ],
      }),
    })
    const { default: Bar } = await import("~/pages/manage/StorageLoadingBar")
    const { unmount } = render(() => <Bar />)
    await settle()
    await new Promise((r) => setTimeout(r, 1700))
    unmount()
    const recs = errorCenter.records()
    expect(recs).toHaveLength(1)
    expect(recs[0]).toMatchObject({
      category: "driver",
      source: "storage.loading",
      message: "Storage /dav failed to load",
      detail: "401 from remote",
      href: "/@manage/storages",
    })
  })
})
