// Which transfer tasks concern the folder the user is looking at (REFACTOR_PLAN
// 7.7). Pure: the store hands in tasks, the Files page hands in the path.
import type { UnifiedTask } from "~/platform/contracts/task"

export const norm = (p: string): string => {
  const trimmed = p.replace(/\/+$/, "")
  return trimmed === "" ? "/" : trimmed
}

/** `child` is `parent` itself or inside it (segment-aware: /a is not /ab). */
export const isUnder = (child: string, parent: string): boolean => {
  const c = norm(child)
  const p = norm(parent)
  return p === "/" || c === p || c.startsWith(p + "/")
}

/** Sync jobs have a `local:` endpoint that is not part of the file tree. */
export const treePath = (p: string | undefined): string | undefined =>
  p && p.startsWith("/") ? p : undefined

/** The task reads from or writes into `path` or anything below it. */
export const touchesPath = (task: UnifiedTask, path: string): boolean => {
  const dst = treePath(task.destination?.path)
  const src = treePath(task.source?.path)
  // A destination below the current folder, or the folder itself or its parent
  // being the source of work, both put something in or out of this view.
  return (
    (dst !== undefined && isUnder(dst, path)) ||
    (src !== undefined && isUnder(src, path))
  )
}

export interface PathTasks {
  active: UnifiedTask[]
  failed: UnifiedTask[]
}

/** In-progress and failed tasks touching `path` or anything below it. */
export const tasksForPath = (
  tasks: readonly UnifiedTask[],
  path: string,
): PathTasks => {
  const out: PathTasks = { active: [], failed: [] }
  for (const t of tasks) {
    if (!touchesPath(t, path)) continue
    if (t.state === "failed") out.failed.push(t)
    else if (
      t.state === "queued" ||
      t.state === "running" ||
      t.state === "waiting_retry" ||
      t.state === "recovering" ||
      t.state === "canceling"
    )
      out.active.push(t)
  }
  return out
}

/** Stable key of a task set; a dismissed card stays dismissed until it changes. */
export const taskSetKey = (tasks: readonly UnifiedTask[]): string =>
  tasks
    .map((t) => `${t.id}:${t.state}`)
    .sort()
    .join("|")

/** Mean of the known percentages, or undefined when none is known. */
export const averagePercent = (
  tasks: readonly UnifiedTask[],
): number | undefined => {
  const known = tasks
    .map((t) => t.progress.percent)
    .filter((p): p is number => typeof p === "number")
  if (known.length === 0) return undefined
  return known.reduce((a, b) => a + b, 0) / known.length
}

const baseName = (p: string): string => norm(p).split("/").pop() ?? ""
const dirName = (p: string): string => {
  const n = norm(p)
  const at = n.lastIndexOf("/")
  return at <= 0 ? "/" : n.slice(0, at)
}

export interface OpenTarget {
  dir: string
  /** File to scroll to and flash in that folder. */
  highlight?: string
}

/**
 * Where "open source folder" / "open destination folder" lead. Undefined when
 * that side is not in the file tree (a sync job's local: end).
 */
export const openTarget = (
  task: UnifiedTask,
  side: "source" | "destination",
): OpenTarget | undefined => {
  const src = treePath(task.source?.path)
  const dst = treePath(task.destination?.path)
  if (side === "source") {
    if (!src) return undefined
    // A file task points at the file; a folder (sync root) just opens it.
    return task.type.startsWith("sync")
      ? { dir: norm(src) }
      : { dir: dirName(src), highlight: baseName(src) || undefined }
  }
  if (!dst) return undefined
  const name = src && !task.type.startsWith("sync") ? baseName(src) : undefined
  return { dir: norm(dst), highlight: name || undefined }
}

/** /@transfers deep links (REFACTOR_PLAN 7.7). */
export const transferLinkFor = (
  tasks: readonly UnifiedTask[],
  path: string,
): string =>
  tasks.length === 1
    ? `/@transfers?task=${encodeURIComponent(tasks[0].id)}`
    : `/@transfers?path=${encodeURIComponent(path)}`

export interface TypeGroup {
  type: string
  count: number
}

/** Counts per task type, in first-seen order (the caller's order is meaningful). */
export const groupByType = (tasks: readonly UnifiedTask[]): TypeGroup[] => {
  const groups = new Map<string, number>()
  for (const t of tasks) groups.set(t.type, (groups.get(t.type) ?? 0) + 1)
  return [...groups].map(([type, count]) => ({ type, count }))
}

/** URL (without base) of the Files page for an open-folder target. */
export const filesLinkFor = (target: OpenTarget): string => {
  const path =
    target.dir === "/"
      ? "/"
      : target.dir.split("/").map(encodeURIComponent).join("/")
  return target.highlight
    ? `${path}?highlight=${encodeURIComponent(target.highlight)}`
    : path
}
