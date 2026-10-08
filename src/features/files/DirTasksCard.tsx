import { TbListDetails, TbX } from "solid-icons/tb"
import {
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  Show,
} from "solid-js"
import { Progress } from "~/components/ui/progress"
import { focusRing } from "~/components/ui/focus"
import { useRouter, useT } from "~/hooks"
import { objStore, State } from "~/store"
import { cn } from "~/utils/cn"
import { joinBase } from "~/utils/path"
import { transfers } from "../transfers/service"
import {
  averagePercent,
  groupByType,
  taskSetKey,
  tasksForPath,
  transferLinkFor,
} from "./tasks-for-path"

// Dismissals are remembered by the set of tasks they covered; a new task (or a
// task changing state) produces a new key, so the card comes back by itself.
const [dismissed, setDismissed] = createSignal<ReadonlySet<string>>(new Set())

/**
 * One line above the file list when transfers touch this folder: "In progress
 * here: Upload 3 · 45%". It reads the shared transfers store, so it adds no
 * request and no timer of its own.
 */
export const DirTasksCard = () => {
  const t = useT()
  const { pathname, to } = useRouter()
  const hit = createMemo(() => tasksForPath(transfers.tasks(), pathname()))
  const all = createMemo(() => [...hit().active, ...hit().failed])
  const key = createMemo(() => taskSetKey(all()))
  const visible = () =>
    objStore.state === State.Folder &&
    all().length > 0 &&
    !dismissed().has(key())

  // While something is running here, ask the store to poll at its fast rate.
  createEffect(() => {
    if (!visible() || hit().active.length === 0) return
    const release = transfers.watch()
    onCleanup(release)
  })

  const label = (tasks: ReturnType<typeof groupByType>) =>
    tasks.map((g) => `${t(`transfers.type.${g.type}`)} ${g.count}`).join(", ")
  const percent = () => averagePercent(hit().active)

  return (
    <Show when={visible()}>
      <div
        data-dir-tasks
        role="status"
        class="flex flex-col gap-1.5 rounded-lg border bg-card px-3 py-2 text-sm text-card-foreground"
      >
        <div class="flex items-center gap-2">
          <TbListDetails class="size-4 shrink-0 text-muted-foreground" />
          <div class="flex min-w-0 flex-1 flex-col">
            <Show when={hit().active.length > 0}>
              <span data-dir-tasks-active class="truncate">
                {t("files.tasks.running", {
                  items: label(groupByType(hit().active)),
                })}
                <Show when={percent() !== undefined}>
                  {" · "}
                  {Math.round(percent()!)}%
                </Show>
              </span>
            </Show>
            <Show when={hit().failed.length > 0}>
              <span data-dir-tasks-failed class="truncate text-destructive">
                {t("files.tasks.failed", {
                  items: label(groupByType(hit().failed)),
                })}
              </span>
            </Show>
          </div>
          <a
            href={joinBase(transferLinkFor(all(), pathname()))}
            data-dir-tasks-open
            onClick={(e) => {
              if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return
              e.preventDefault()
              to(transferLinkFor(all(), pathname()))
            }}
            class={cn(
              focusRing,
              "shrink-0 rounded-md px-2 py-1 text-xs font-medium text-primary no-underline hover:bg-accent hover:no-underline",
            )}
          >
            {t("files.tasks.open")}
          </a>
          <button
            type="button"
            data-dir-tasks-dismiss
            aria-label={t("files.dismiss")}
            onClick={() => setDismissed(new Set([...dismissed(), key()]))}
            class={cn(
              focusRing,
              "inline-flex size-7 shrink-0 items-center justify-center rounded-md bg-transparent text-muted-foreground hover:bg-accent",
            )}
          >
            <TbX class="size-4" />
          </button>
        </div>
        <Show when={hit().active.length > 0}>
          <Progress
            value={percent() ?? 0}
            minValue={0}
            maxValue={100}
            indeterminate={percent() === undefined}
            class="gap-0"
          />
        </Show>
      </div>
    </Show>
  )
}
