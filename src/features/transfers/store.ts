// The single polling service behind Transfers and the Task Center. The whole
// app has exactly one timer, owned by this store.
import { batch, createMemo, createRoot, createSignal, untrack } from "solid-js"
import type { SyncSnapshot, UnifiedTask } from "~/platform/contracts/task"
import {
  isTacheType,
  mapLocalUpload,
  mapSyncSnapshot,
  mapTache,
  sectionOf,
  sortTasks,
  TACHE_TYPES,
  tacheTypesOf,
  type FilterKey,
  type TacheRaw,
  type TacheType,
  type TaskAction,
} from "./adapter"
import type { LocalUploads, UploadStatus } from "./local-uploads"
import { createStallTracker } from "./stall"

export const FAST_MS = 2000
export const SLOW_MS = 15000
/** One done-list fetch per this many undone fetches. */
export const DONE_EVERY = 4

const SEEN_KEY = "transfers-seen-failed"
const SEEN_CAP = 500
/** A finished task older than this is history, not something that just happened. */
const RECENT_MS = 2 * 60 * 1000

interface Result<T> {
  code: number
  message: string
  data: T
}

export interface StoreDeps {
  fetchTache: (
    type: TacheType,
    done: boolean,
  ) => Promise<Result<TacheRaw[] | null>>
  postTache: (
    type: TacheType,
    action: TaskAction,
    tid?: string,
  ) => Promise<Result<unknown>>
  fetchSyncList: () => Promise<Result<SyncSnapshot[] | null>>
  fetchSyncHistory: () => Promise<Result<SyncSnapshot[] | null>>
  fetchSyncJob: (id: string) => Promise<Result<SyncSnapshot>>
  cancelSync: (id: string) => Promise<Result<unknown>>
  isAdmin: () => boolean
  isHidden: () => boolean
  /** Uploads running in this tab; merged into the task list as they are. */
  localUploads?: Pick<
    LocalUploads,
    "list" | "restart" | "remove" | "clearFinished"
  >
  notifyError: (msg: string) => void
  info: (msg: string) => void
  now: () => Date
  storage: Pick<Storage, "getItem" | "setItem">
  /**
   * Called once per task when it finishes successfully while this store is
   * watching (tasks that were already finished at the first load are not
   * reported). The Files page uses it to refresh the open directory.
   */
  onSucceeded?: (task: UnifiedTask) => void
  /**
   * Called once per task that failed since the user last looked at the
   * failures (the same "unseen" the badge dot uses), unless it ended long ago.
   */
  onFailed?: (task: UnifiedTask) => void
}

export type SyncCapability = "unknown" | "yes" | "no"

const readSeen = (s: StoreDeps["storage"]): string[] => {
  try {
    const v = JSON.parse(s.getItem(SEEN_KEY) ?? "[]")
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : []
  } catch {
    return []
  }
}

const emptyByType = () =>
  Object.fromEntries(
    TACHE_TYPES.map((t) => [t, [] as UnifiedTask[]]),
  ) as Record<TacheType, UnifiedTask[]>

export const createTransfersStore = (deps: StoreDeps) =>
  createRoot((dispose) => {
    const [undone, setUndone] = createSignal(emptyByType())
    const [done, setDone] = createSignal(emptyByType())
    const [syncTasks, setSyncTasks] = createSignal<UnifiedTask[]>([])
    const [history, setHistory] = createSignal<UnifiedTask[]>([])
    const [capability, setCapability] = createSignal<SyncCapability>("unknown")
    const [seen, setSeen] = createSignal(new Set(readSeen(deps.storage)))
    const [loaded, setLoaded] = createSignal(false)
    // Full snapshot (with events) of the sync job whose detail is open.
    const [detailId, setDetailId] = createSignal<string>()
    const [detail, setDetail] = createSignal<UnifiedTask>()
    const stall = createStallTracker()

    // Not polled: the source is reactive, so these follow the upload at once.
    const localTasks = createMemo(() =>
      (deps.localUploads?.list() ?? []).map(mapLocalUpload),
    )

    const tasks = createMemo(() => {
      const all: UnifiedTask[] = []
      const ids = new Set<string>()
      // A task can sit in both lists for one poll; the undone copy is fresher.
      for (const list of [
        ...Object.values(undone()),
        ...Object.values(done()),
        syncTasks(),
        localTasks(),
      ]) {
        for (const t of list) {
          if (ids.has(t.id)) continue
          ids.add(t.id)
          all.push(t)
        }
      }
      return sortTasks(all)
    })
    const activeCount = createMemo(
      () => tasks().filter((t) => sectionOf(t.state) === "active").length,
    )
    const failedIds = createMemo(() =>
      tasks()
        .filter((t) => t.state === "failed")
        .map((t) => t.id),
    )
    const failedUnseenCount = createMemo(
      () => failedIds().filter((id) => !seen().has(id)).length,
    )

    // ---- completion detection ---------------------------------------------
    // A task counts as "just succeeded" the first time it is seen succeeded
    // after the initial load. Remembering reported ids makes it once per task
    // however many polls or lists it appears in.
    const lastState = new Map<string, string>()
    const reported = new Set<string>()
    let baselined = false
    const detectSucceeded = () => {
      const list = untrack(tasks)
      for (const t of list) {
        const prev = lastState.get(t.id)
        lastState.set(t.id, t.state)
        if (!baselined || t.state !== "succeeded" || prev === "succeeded")
          continue
        if (reported.has(t.id)) continue
        // A listing that failed on the first load can surface old finished
        // tasks later; only tasks that ended recently count as news.
        const age = deps.now().getTime() - Date.parse(t.endedAt ?? "")
        if (age >= RECENT_MS) continue
        reported.add(t.id)
        try {
          deps.onSucceeded?.(t)
        } catch {
          // a listener must not break polling
        }
      }
      baselined = true
    }

    // A failure counts as news while the user has not seen it (the badge dot)
    // and it is recent; the id is remembered so polls report it once.
    const failedReported = new Set<string>()
    const detectFailed = () => {
      for (const t of untrack(tasks)) {
        if (t.state !== "failed" || failedReported.has(t.id)) continue
        if (untrack(seen).has(t.id)) continue
        const age = deps.now().getTime() - Date.parse(t.endedAt ?? "")
        if (Number.isFinite(age) && age >= RECENT_MS) continue
        failedReported.add(t.id)
        try {
          deps.onFailed?.(t)
        } catch {
          // a listener must not break polling
        }
      }
    }

    // ---- polling ----------------------------------------------------------
    let timer: ReturnType<typeof setTimeout> | undefined
    let started = false
    let viewers = 0
    let undoneSinceDone = DONE_EVERY - 1 // first fetch includes done
    let inflight: Promise<void> | undefined
    let rerun: { full: boolean } | undefined
    let infoLogged = false

    const interval = () =>
      viewers > 0 && activeCount() > 0 ? FAST_MS : SLOW_MS

    const schedule = () => {
      if (timer !== undefined) clearTimeout(timer)
      timer = undefined
      if (!started || deps.isHidden()) return
      timer = setTimeout(() => {
        timer = undefined
        void refresh({ full: false })
      }, interval())
    }

    const stampByType = (byType: Record<TacheType, UnifiedTask[]>) =>
      Object.fromEntries(
        TACHE_TYPES.map((type) => [type, byType[type].map(stall.stamp)]),
      ) as Record<TacheType, UnifiedTask[]>

    const mapList = (
      type: TacheType,
      list: TacheRaw[] | null,
      isDone: boolean,
      now: Date,
    ) => (list ?? []).map((raw) => mapTache(raw, type, isDone, now))

    const fetchSide = async (isDone: boolean, now: Date) => {
      const results = await Promise.all(
        TACHE_TYPES.map(async (type) => {
          try {
            const resp = await deps.fetchTache(type, isDone)
            return resp.code === 200
              ? mapList(type, resp.data, isDone, now)
              : undefined
          } catch {
            return undefined
          }
        }),
      )
      const prev = isDone ? done() : undone()
      const next = { ...prev }
      TACHE_TYPES.forEach((type, i) => {
        // A failed type keeps its last good data instead of flashing empty.
        if (results[i]) next[type] = results[i]!
      })
      return next
    }

    /** The fresh sync tasks, or undefined when there are none to replace the old ones. */
    const fetchSync = async (now: Date) => {
      if (!deps.isAdmin() || capability() === "no") return undefined
      try {
        const resp = await deps.fetchSyncList()
        if (resp.code === 404 || resp.code === 405) {
          setCapability("no")
          setSyncTasks([])
          if (!infoLogged) {
            infoLogged = true
            deps.info("sync API not available on this backend; hiding sync UI")
          }
          return undefined
        }
        if (resp.code === 200) {
          setCapability("yes")
          return (resp.data ?? []).map((s) => mapSyncSnapshot(s, now))
        }
      } catch {
        // transient: keep what we have
      }
      return undefined
    }

    const fetchDetail = async (now: Date) => {
      const id = detailId()
      if (!id || capability() !== "yes") return
      try {
        const resp = await deps.fetchSyncJob(id)
        if (resp.code === 200 && detailId() === id) {
          setDetail(mapSyncSnapshot(resp.data, now))
        }
      } catch {
        // keep the previous detail
      }
    }

    const doRefresh = async (full: boolean) => {
      const now = deps.now()
      const nextUndone = await fetchSide(false, now)
      const before = new Set(
        Object.values(undone())
          .flat()
          .map((t) => t.id),
      )
      const after = new Set(
        Object.values(nextUndone)
          .flat()
          .map((t) => t.id),
      )
      // A task that left the undone list has moved to done: fetch done now so
      // it doesn't vanish until the next scheduled done poll.
      const vanished = [...before].some((id) => !after.has(id))
      let nextDone: ReturnType<typeof emptyByType> | undefined
      if (full || vanished || undoneSinceDone >= DONE_EVERY - 1) {
        nextDone = await fetchSide(true, now)
        undoneSinceDone = 0
      } else {
        undoneSinceDone++
      }
      const nextSync = await fetchSync(now)
      await fetchDetail(now)
      // Every poll passes through the stall tracker once, here, so a task's
      // progress time and stale flag come from one place.
      stall.track(
        [...Object.values(nextUndone).flat(), ...(nextSync ?? syncTasks())],
        now.getTime(),
      )
      batch(() => {
        setUndone(stampByType(nextUndone))
        if (nextDone) setDone(nextDone)
        if (nextSync) setSyncTasks(nextSync.map(stall.stamp))
        else setSyncTasks((list) => list.map(stall.stamp))
        setDetail((d) => d && stall.stamp(d))
        setLoaded(true)
      })
      detectSucceeded()
      detectFailed()
    }

    const refresh = (opts: { full?: boolean } = {}): Promise<void> => {
      const full = opts.full ?? true
      if (inflight) {
        rerun = { full: full || !!rerun?.full }
        return inflight
      }
      inflight = doRefresh(full)
        .catch(() => {})
        .finally(() => {
          inflight = undefined
          const again = rerun
          rerun = undefined
          if (again) void refresh(again)
          else schedule()
        })
      return inflight
    }

    const onVisibility = () => {
      if (deps.isHidden()) {
        if (timer !== undefined) clearTimeout(timer)
        timer = undefined
        stall.pause(deps.now().getTime())
      } else if (started) {
        void refresh({ full: false })
      }
    }

    /** Begin polling; returns a stop function. Idempotent. */
    const start = (): (() => void) => {
      if (started) return () => {}
      started = true
      if (typeof document !== "undefined") {
        document.addEventListener("visibilitychange", onVisibility)
      }
      if (!deps.isHidden()) void refresh({ full: true })
      return stop
    }
    const stop = () => {
      started = false
      if (timer !== undefined) clearTimeout(timer)
      timer = undefined
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibility)
      }
    }

    /**
     * Declare that a view that wants fast updates (Transfers page, Task Center
     * drawer) is open. Returns a release function.
     */
    const watch = (): (() => void) => {
      viewers++
      schedule()
      let released = false
      return () => {
        if (released) return
        released = true
        viewers--
        schedule()
      }
    }

    // ---- actions ----------------------------------------------------------
    const report = (resp: Result<unknown> | undefined, err?: unknown) => {
      if (err !== undefined) {
        deps.notifyError(err instanceof Error ? err.message : String(err))
        return false
      }
      if (!resp || resp.code !== 200) {
        deps.notifyError(resp?.message || `HTTP ${resp?.code ?? "error"}`)
        return false
      }
      return true
    }

    const act = async (
      taskId: string,
      action: TaskAction,
    ): Promise<boolean> => {
      const task = tasks().find((t) => t.id === taskId)
      if (!task) return false
      if (task.legacy.kind === "upload_local") {
        const local = deps.localUploads
        if (!local) return false
        if (action === "retry") return local.restart(task.legacy.id)
        if (action !== "delete") return false
        local.remove([task.legacy.id])
        return true
      }
      let ok: boolean
      try {
        if (task.legacy.kind === "sync") {
          ok = report(await deps.cancelSync(task.legacy.snapshot.id))
        } else {
          const type = task.legacy.tacheType
          ok = isTacheType(type)
            ? report(await deps.postTache(type, action, task.correlationId))
            : false
        }
      } catch (e) {
        ok = report(undefined, e)
      }
      await refresh({ full: true })
      return ok
    }

    const CLEARS: Partial<Record<TaskAction, UploadStatus[]>> = {
      clear_done: ["success", "error"],
      clear_succeeded: ["success"],
    }
    /** The bulk actions the in-browser uploads can do themselves. */
    const bulkLocal = (action: TaskAction) => {
      const local = deps.localUploads
      if (!local) return
      const clears = CLEARS[action]
      if (clears) local.clearFinished(clears)
      else if (action === "retry_failed") {
        for (const u of local.list()) {
          if (u.status === "error" && u.retryable) local.restart(u.id)
        }
      }
    }

    /** Bulk actions (clear / retry failed) over every type of a filter chip. */
    const actBulk = async (
      key: FilterKey,
      action: TaskAction,
    ): Promise<boolean> => {
      let all = true
      if (key === "all" || key === "upload") bulkLocal(action)
      for (const type of tacheTypesOf(key)) {
        try {
          all = report(await deps.postTache(type, action)) && all
        } catch (e) {
          all = report(undefined, e) && all
        }
      }
      await refresh({ full: true })
      return all
    }

    /** Forget everything: used on logout so the next user starts clean. */
    const reset = () => {
      batch(() => {
        setUndone(emptyByType())
        setDone(emptyByType())
        setSyncTasks([])
        setHistory([])
        setDetail(undefined)
        setDetailId(undefined)
        setCapability("unknown")
        setLoaded(false)
      })
      undoneSinceDone = DONE_EVERY - 1
      infoLogged = false
      stall.clear()
      lastState.clear()
      reported.clear()
      failedReported.clear()
      baselined = false
    }

    const markFailedSeen = () =>
      untrack(() => {
        const next = new Set([...seen(), ...failedIds()])
        const arr = [...next].slice(-SEEN_CAP)
        setSeen(new Set(arr))
        try {
          deps.storage.setItem(SEEN_KEY, JSON.stringify(arr))
        } catch {
          // seen-state just doesn't persist
        }
      })

    /** Open (or with undefined, close) the sync job detail; fetches at once. */
    const openJob = (id: string | undefined) => {
      setDetail(undefined)
      setDetailId(id)
      if (id) void refresh({ full: false })
    }

    const loadHistory = async () => {
      if (!deps.isAdmin() || capability() === "no") return
      try {
        const resp = await deps.fetchSyncHistory()
        if (resp.code === 200) {
          const now = deps.now()
          setHistory((resp.data ?? []).map((s) => mapSyncSnapshot(s, now)))
        } else if (resp.code === 404 || resp.code === 405) {
          setCapability("no")
        } else {
          deps.notifyError(resp.message)
        }
      } catch (e) {
        report(undefined, e)
      }
    }

    return {
      tasks,
      activeCount,
      failedUnseenCount,
      loaded,
      history,
      detail,
      openJob,
      syncAvailable: () => capability() === "yes",
      syncCapability: capability,
      refresh,
      act,
      actBulk,
      markFailedSeen,
      reset,
      loadHistory,
      start,
      stop,
      watch,
      dispose,
    }
  })

export type TransfersStore = ReturnType<typeof createTransfersStore>
