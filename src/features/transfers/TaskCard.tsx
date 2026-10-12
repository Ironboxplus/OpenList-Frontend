import { packStage } from "./pack"
import { focusRing } from "~/components/ui/focus"
import {
  TbArrowsMove,
  TbBolt,
  TbCloudUpload,
  TbCopy,
  TbDownload,
  TbFileZip,
  TbRefreshDot,
} from "solid-icons/tb"
import { createSignal, For, Show } from "solid-js"
import { Dynamic } from "solid-js/web"
import { Button } from "~/components/ui/button"
import { Card } from "~/components/ui/card"
import { Progress } from "~/components/ui/progress"
import { useT } from "~/hooks"
import type { UnifiedTask } from "~/platform/contracts/task"
import { cn } from "~/utils/cn"
import { availableActions, sectionOf, type TaskAction } from "./adapter"
import type { OpenTarget } from "../files/tasks-for-path"
import { ConfirmDeleteDialog } from "./ConfirmDeleteDialog"
import { OpenFolderButtons } from "./OpenFolderButtons"
import { formatBytes, formatEta } from "./format"
import { StaleBadge, StateBadge } from "./StateBadge"
import { TaskTitle } from "./TaskTitle"

const ICONS: Record<string, typeof TbCopy> = {
  "file.upload": TbCloudUpload,
  "file.copy": TbCopy,
  "file.move": TbArrowsMove,
  "offline.download": TbDownload,
  "offline.transfer": TbDownload,
  "archive.extract": TbFileZip,
  "archive.upload": TbFileZip,
}

export const TaskIcon = (props: { type: string; class?: string }) => (
  <Dynamic
    component={
      ICONS[props.type] ??
      (props.type.startsWith("sync.") ? TbRefreshDot : TbBolt)
    }
    class={props.class ?? "size-5"}
  />
)

export interface TaskCardProps {
  task: UnifiedTask
  /** Compact cards (Task Center drawer) drop the stats rows and the buttons. */
  compact?: boolean
  /** Ring the card: it is what the user just started. */
  highlight?: boolean
  onOpen?: (task: UnifiedTask) => void
  onAction?: (task: UnifiedTask, action: TaskAction) => void
  /** Open a folder in the Files page; enables the open source/destination buttons. */
  onOpenPath?: (target: OpenTarget) => void
}

export const TaskCard = (props: TaskCardProps) => {
  const t = useT()
  const [errorOpen, setErrorOpen] = createSignal(false)
  const [confirming, setConfirming] = createSignal(false)

  const p = () => props.task.progress
  const state = () => props.task.state
  const running = () => state() === "running"
  const sync = () =>
    props.task.legacy.kind === "sync" ? props.task.legacy.snapshot : undefined

  // Determinate bar when we have a percentage; an unknown-progress running
  // task gets the indeterminate animation; everything else shows no bar.
  const showBar = () =>
    running() ||
    (p().percent !== undefined &&
      !(sectionOf(state()) !== "active" && !p().percent))

  const sizeText = () => {
    const { percent, bytesDone, bytesTotal } = p()
    if (sync() && running() && bytesDone !== undefined && bytesTotal) {
      return t("transfers.card.discovered", {
        done: formatBytes(bytesDone),
        total: formatBytes(bytesTotal),
      })
    }
    if (bytesTotal) {
      const done =
        bytesDone ??
        (percent !== undefined ? (percent / 100) * bytesTotal : undefined)
      return done !== undefined
        ? t("transfers.card.transferred", {
            done: formatBytes(done),
            total: formatBytes(bytesTotal),
          })
        : t("transfers.card.total", { total: formatBytes(bytesTotal) })
    }
    return undefined
  }
  const checking = () =>
    sync() !== undefined && running() && props.task.phase === "checking"
  const metaParts = () => {
    const parts: string[] = []
    const stage = running() ? packStage(sync()?.stage) : undefined
    if (stage) {
      const ps = sync()?.pack_stats
      parts.push(
        stage === "packing"
          ? t("transfers.card.packing", {
              files: ps?.packed_files ?? 0,
              packs: ps?.packs_written ?? ps?.packs ?? 0,
            })
          : t("transfers.card.unpacking", { files: ps?.unpacked_files ?? 0 }),
      )
      return parts
    }
    if (checking()) {
      // Nothing is queued yet, so bytes/files would read 0 / 0: say what is happening.
      const { checksDone, scanned } = p()
      parts.push(
        scanned
          ? t("transfers.card.checking", { checked: checksDone ?? 0, scanned })
          : t("transfers.card.checking_short", { checked: checksDone ?? 0 }),
      )
      return parts
    }
    const size = sizeText()
    if (size) parts.push(size)
    if (p().itemsTotal && p().itemsDone !== undefined) {
      parts.push(
        t("transfers.card.files", {
          done: p().itemsDone!,
          total: p().itemsTotal!,
        }),
      )
    }
    if (running() && p().speedBytesPerSecond) {
      parts.push(
        t("transfers.card.speed", {
          speed: formatBytes(p().speedBytesPerSecond),
        }),
      )
    }
    const eta = running() ? formatEta(p().etaMs) : undefined
    if (eta) parts.push(t("transfers.card.eta", { eta }))
    return parts
  }

  const actions = () => (props.compact ? [] : availableActions(props.task))
  const act = (a: TaskAction) => (e: MouseEvent) => {
    e.stopPropagation()
    if (a === "delete") setConfirming(true)
    else props.onAction?.(props.task, a)
  }

  return (
    <>
      <Card
        data-testid="task-card"
        data-task-id={props.task.id}
        data-highlight={props.highlight ? "" : undefined}
        data-state={state()}
        data-section={sectionOf(state())}
        tabIndex={props.onOpen ? 0 : undefined}
        role={props.onOpen ? "button" : undefined}
        class={cn(
          "flex flex-col gap-3 p-4",
          props.onOpen && focusRing,
          props.compact && "gap-2 p-3",
          props.highlight && "ring-2 ring-primary",
          props.onOpen && "cursor-pointer transition-shadow hover:shadow-md",
        )}
        onClick={() => props.onOpen?.(props.task)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && e.target === e.currentTarget) {
            props.onOpen?.(props.task)
          }
        }}
      >
        <div class="flex items-center gap-2">
          <TaskIcon
            type={props.task.type}
            class="size-5 shrink-0 text-muted-foreground"
          />
          <TaskTitle task={props.task} class="flex-1 text-sm font-medium" />
          <StateBadge state={state()} />
          <StaleBadge task={props.task} />
        </div>

        <Show when={showBar()}>
          <Progress
            value={p().percent ?? 0}
            minValue={0}
            maxValue={100}
            indeterminate={p().percent === undefined}
          />
        </Show>

        <Show when={!props.compact && metaParts().length > 0}>
          <p class="text-xs text-muted-foreground" data-testid="task-meta">
            {metaParts().join(" · ")}
          </p>
        </Show>

        <Show when={!props.compact && sync()}>
          {(s) => (
            <div
              class="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground"
              data-testid="sync-counts"
            >
              <span>
                {t("transfers.sync.rapid", {
                  count: s().counters.rapid_uploads,
                  saved: formatBytes(s().counters.rapid_bytes),
                })}
              </span>
              <span>
                {t("transfers.sync.uploaded", {
                  count: s().counters.uploaded - s().counters.rapid_uploads,
                  bytes: formatBytes(s().counters.uploaded_bytes),
                })}
              </span>
              <span>
                {t("transfers.sync.match", { count: s().counters.match })}
              </span>
              <span class={cn(s().counters.errors > 0 && "text-destructive")}>
                {t("transfers.sync.errors", { count: s().counters.errors })}
              </span>
            </div>
          )}
        </Show>

        <Show when={props.task.error}>
          {(err) => (
            <button
              type="button"
              data-testid="task-error"
              aria-expanded={errorOpen()}
              title={
                errorOpen()
                  ? t("transfers.card.hide_error")
                  : t("transfers.card.show_error")
              }
              class={cn(
                focusRing,
                "break-words rounded-md bg-destructive/10 px-2 py-1 text-left text-xs text-destructive",
                !errorOpen() && "line-clamp-2",
              )}
              onClick={(e) => {
                e.stopPropagation()
                setErrorOpen(!errorOpen())
              }}
            >
              {err().message}
            </button>
          )}
        </Show>

        <Show when={!props.compact}>
          <OpenFolderButtons task={props.task} onOpenPath={props.onOpenPath} />
        </Show>

        <Show when={actions().length > 0}>
          <div class="flex justify-end gap-2">
            <For each={actions()}>
              {(a) => (
                <Button
                  size="sm"
                  variant={
                    a === "delete"
                      ? "outline"
                      : a === "retry"
                        ? "default"
                        : "secondary"
                  }
                  class={cn(a === "delete" && "text-destructive")}
                  data-action={a}
                  onClick={act(a)}
                >
                  {t(`transfers.action.${a}`)}
                </Button>
              )}
            </For>
          </div>
        </Show>
      </Card>

      <ConfirmDeleteDialog
        open={confirming()}
        onOpenChange={setConfirming}
        onConfirm={() => props.onAction?.(props.task, "delete")}
      />
    </>
  )
}
