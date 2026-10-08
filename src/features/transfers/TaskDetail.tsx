import { focusRing } from "~/components/ui/focus"
import { createMemo, createSignal, For, type JSX, Show } from "solid-js"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Progress } from "~/components/ui/progress"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs"
import { useT } from "~/hooks"
import type {
  SyncEvent,
  SyncEventKind,
  SyncSnapshot,
  UnifiedTask,
} from "~/platform/contracts/task"
import { cn } from "~/utils/cn"
import { availableActions, syncPhase, type TaskAction } from "./adapter"
import type { OpenTarget } from "../files/tasks-for-path"
import { ConfirmDeleteDialog } from "./ConfirmDeleteDialog"
import { OpenFolderButtons } from "./OpenFolderButtons"
import { formatBytes, formatEta, formatTime } from "./format"
import { StateBadge } from "./StateBadge"
import { TaskTitle } from "./TaskTitle"

const EVENT_KINDS: SyncEventKind[] = [
  "uploaded",
  "rapid",
  "only_in_src",
  "only_in_dst",
  "differ",
  "error",
]

const EVENT_TONE: Record<SyncEventKind, string> = {
  uploaded: "bg-success/15 text-success",
  rapid: "bg-primary/10 text-primary",
  only_in_src: "bg-warning/15 text-warning",
  only_in_dst: "bg-warning/15 text-warning",
  differ: "bg-muted text-foreground",
  error: "bg-destructive/10 text-destructive",
}

const Field = (props: { label: string; children: JSX.Element }) => (
  <div class="grid grid-cols-[7rem_1fr] gap-2 text-sm">
    <dt class="text-muted-foreground">{props.label}</dt>
    <dd class="min-w-0 break-all">{props.children}</dd>
  </div>
)

const SyncDetail = (props: {
  task: UnifiedTask
  snapshot: SyncSnapshot
  /** True while the full snapshot (with events) has not arrived yet. */
  loading: boolean
}) => {
  const t = useT()
  const [kind, setKind] = createSignal<SyncEventKind | "all">("all")
  const events = createMemo<SyncEvent[]>(() => {
    const all = (props.snapshot.events ?? []).slice().reverse()
    return kind() === "all" ? all : all.filter((e) => e.kind === kind())
  })
  const transferring = () => props.snapshot.stats?.transferring ?? []
  const spec = () => props.snapshot.spec
  const stats = () => props.snapshot.stats ?? {}
  const checking = () =>
    props.snapshot.state === "running" &&
    syncPhase(props.snapshot.stats) === "checking"

  return (
    <Tabs defaultValue="overview" class="mt-4">
      <TabsList class="w-full">
        <TabsTrigger value="overview" class="flex-1">
          {t("transfers.detail.tab.overview")}
        </TabsTrigger>
        <TabsTrigger value="transferring" class="flex-1">
          {t("transfers.detail.tab.transferring")}
        </TabsTrigger>
        <TabsTrigger value="events" class="flex-1">
          {t("transfers.detail.tab.events")}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="overview" class="mt-4 flex flex-col gap-4">
        <dl class="flex flex-col gap-2" data-testid="sync-spec">
          <Field label={t("transfers.detail.mode")}>{spec().mode}</Field>
          <Field label={t("transfers.detail.source")}>{spec().src}</Field>
          <Field label={t("transfers.detail.destination")}>{spec().dst}</Field>
          <Field label={t("transfers.detail.spec")}>
            {[
              spec().dry_run && t("transfers.form.dry_run"),
              spec().size_only && t("transfers.form.size_only"),
              spec().track_renames && t("transfers.form.track_renames"),
              spec().resync && t("transfers.form.resync"),
              spec().force && t("transfers.form.force"),
              spec().transfers > 0 &&
                `${t("transfers.form.transfers")}: ${spec().transfers}`,
              spec().checkers > 0 &&
                `${t("transfers.form.checkers")}: ${spec().checkers}`,
              spec().max_delete !== undefined &&
                `${t("transfers.form.max_delete")}: ${spec().max_delete}`,
            ]
              .filter(Boolean)
              .join(" · ") || t("transfers.detail.none")}
          </Field>
          <Field label={t("transfers.detail.filters")}>
            <Show
              when={spec().filters?.length}
              fallback={t("transfers.detail.none")}
            >
              <pre class="whitespace-pre-wrap font-mono text-xs">
                {spec().filters.join("\n")}
              </pre>
            </Show>
          </Field>
        </dl>

        <div>
          <h4 class="mb-2 text-sm font-medium">
            {t("transfers.detail.counters")}
          </h4>
          <div class="grid grid-cols-2 gap-2" data-testid="sync-counters">
            <For each={Object.entries(props.snapshot.counters)}>
              {([k, v]) => (
                <div class="rounded-lg border px-3 py-2">
                  <div class="text-xs text-muted-foreground">
                    {t(`transfers.counter.${k}`, undefined, k)}
                  </div>
                  <div class="text-sm font-medium">
                    {k.endsWith("bytes") ? formatBytes(v as number) : v}
                  </div>
                </div>
              )}
            </For>
          </div>
        </div>

        <div>
          <h4 class="mb-2 text-sm font-medium">
            {t("transfers.detail.stats")}
          </h4>
          <dl class="flex flex-col gap-1 text-sm">
            <Show when={checking() || (stats().checks ?? 0) > 0}>
              <Field label={t("transfers.detail.checks")}>
                {stats().checks ?? 0} / {stats().totalChecks ?? "-"}
              </Field>
            </Show>
            <Show when={(stats().listed ?? 0) > 0}>
              <Field label={t("transfers.detail.scanned")}>
                {stats().listed}
              </Field>
            </Show>
            <Show when={!checking() && (stats().totalBytes || stats().bytes)}>
              <Field label={t("transfers.detail.bytes")}>
                {formatBytes(stats().bytes)} / {formatBytes(stats().totalBytes)}
              </Field>
            </Show>
            <Show
              when={
                !checking() && (stats().totalTransfers || stats().transfers)
              }
            >
              <Field label={t("transfers.detail.files")}>
                {stats().transfers ?? "-"} / {stats().totalTransfers ?? "-"}
              </Field>
            </Show>
            <Show when={!checking()}>
              <Field label={t("transfers.detail.speed")}>
                {stats().speed ? `${formatBytes(stats().speed)}/s` : "-"}
                {" · "}
                {formatEta(
                  typeof stats().eta === "number"
                    ? stats().eta! * 1000
                    : undefined,
                ) ?? "-"}
              </Field>
            </Show>
          </dl>
        </div>
      </TabsContent>

      <TabsContent value="transferring" class="mt-4 flex flex-col gap-3">
        <Show
          when={transferring().length > 0}
          fallback={
            <p class="text-sm text-muted-foreground">
              {t("transfers.detail.no_transferring")}
            </p>
          }
        >
          <For each={transferring()}>
            {(f) => (
              <div class="rounded-lg border p-3" data-testid="transferring-row">
                <div class="mb-1 truncate text-sm" title={f.name}>
                  {f.name}
                </div>
                <Progress value={f.percentage} minValue={0} maxValue={100} />
                <div class="mt-1 flex justify-between text-xs text-muted-foreground">
                  <span>
                    {formatBytes(f.size)} · {Math.round(f.percentage)}%
                  </span>
                  <span>{f.speed ? `${formatBytes(f.speed)}/s` : ""}</span>
                </div>
              </div>
            )}
          </For>
        </Show>
      </TabsContent>

      <TabsContent value="events" class="mt-4 flex flex-col gap-3">
        <div class="flex flex-wrap gap-1.5">
          <For each={["all", ...EVENT_KINDS] as const}>
            {(k) => (
              <button
                type="button"
                data-kind={k}
                aria-pressed={kind() === k}
                class={cn(
                  focusRing,
                  "rounded-full border bg-transparent px-2.5 py-0.5 text-xs text-foreground transition-colors",
                  kind() === k
                    ? "border-primary bg-primary text-primary-foreground"
                    : "hover:bg-accent",
                )}
                onClick={() => setKind(k)}
              >
                {k === "all"
                  ? t("transfers.detail.event_filter_all")
                  : t(`transfers.event.${k}`)}
              </button>
            )}
          </For>
        </div>
        <Show
          when={!props.loading}
          fallback={
            <p class="text-sm text-muted-foreground">
              {t("transfers.detail.loading")}
            </p>
          }
        >
          <Show
            when={events().length > 0}
            fallback={
              <p class="text-sm text-muted-foreground">
                {t("transfers.detail.no_events")}
              </p>
            }
          >
            <p class="text-xs text-muted-foreground">
              {t("transfers.detail.events_limit", { count: 1000 })}
            </p>
            <ul class="flex flex-col gap-1" data-testid="sync-events">
              <For each={events()}>
                {(e) => (
                  <li class="flex items-start gap-2 text-xs">
                    <span class="shrink-0 font-mono text-muted-foreground">
                      {new Date(e.time).toLocaleTimeString()}
                    </span>
                    <Badge
                      variant="secondary"
                      class={cn(
                        "shrink-0 border-transparent",
                        EVENT_TONE[e.kind],
                      )}
                    >
                      {t(`transfers.event.${e.kind}`)}
                    </Badge>
                    <span class="min-w-0 break-all">
                      {e.path}
                      <Show when={e.size}>
                        <span class="text-muted-foreground">
                          {" "}
                          ({formatBytes(e.size)})
                        </span>
                      </Show>
                      <Show when={e.error}>
                        <span class="block text-destructive">{e.error}</span>
                      </Show>
                    </span>
                  </li>
                )}
              </For>
            </ul>
          </Show>
        </Show>
      </TabsContent>
    </Tabs>
  )
}

export interface TaskDetailProps {
  task: UnifiedTask | undefined
  /** Full snapshot (with events) for a sync job, once fetched. */
  syncDetail: UnifiedTask | undefined
  onClose: () => void
  onAction: (task: UnifiedTask, action: TaskAction) => void
  /** Open a folder in the Files page; enables the open source/destination buttons. */
  onOpenPath?: (target: OpenTarget) => void
}

export const TaskDetail = (props: TaskDetailProps) => {
  const t = useT()
  // Keep the last task while the sheet animates out.
  const [last, setLast] = createSignal<UnifiedTask>()
  const task = () => {
    const cur = props.task
    if (cur) setLast(cur)
    return cur ?? last()
  }
  const lg = () => task()?.legacy
  const [confirming, setConfirming] = createSignal(false)

  return (
    <>
      <Sheet open={!!props.task} onOpenChange={(o) => !o && props.onClose()}>
        <SheetContent class="flex w-full max-w-none flex-col overflow-y-auto sm:w-[480px] sm:max-w-[480px]">
          <Show when={task()}>
            {(tk) => (
              <>
                <SheetHeader>
                  <SheetTitle class="sr-only">
                    {t("transfers.detail.title")}
                  </SheetTitle>
                  <div class="flex items-center gap-2 pr-6">
                    <TaskTitle
                      task={tk()}
                      class="flex-1 text-base font-semibold"
                    />
                    <StateBadge state={tk().state} />
                  </div>
                </SheetHeader>

                <Show
                  when={lg()?.kind === "sync"}
                  fallback={
                    <dl
                      class="mt-4 flex flex-col gap-2"
                      data-testid="task-fields"
                    >
                      <Field label={t("transfers.detail.id")}>
                        {tk().correlationId}
                      </Field>
                      <Field label={t("transfers.detail.type")}>
                        {t(`transfers.type.${tk().type}`)}
                      </Field>
                      <Show when={tk().source}>
                        <Field label={t("transfers.detail.source")}>
                          {tk().source!.path}
                        </Field>
                      </Show>
                      <Show when={tk().destination}>
                        <Field label={t("transfers.detail.destination")}>
                          {tk().destination!.path}
                        </Field>
                      </Show>
                      <Show when={tk().creatorId}>
                        <Field label={t("transfers.detail.creator")}>
                          {tk().creatorId}
                        </Field>
                      </Show>
                      <Show when={tk().phase}>
                        <Field label={t("transfers.detail.phase")}>
                          {tk().phase}
                        </Field>
                      </Show>
                      <Field label={t("transfers.detail.started")}>
                        {formatTime(tk().startedAt)}
                      </Field>
                      <Field label={t("transfers.detail.ended")}>
                        {formatTime(tk().endedAt)}
                      </Field>
                      <Show when={tk().progress.percent !== undefined}>
                        <Field label={t("transfers.detail.progress")}>
                          {Math.round(tk().progress.percent!)}%
                        </Field>
                      </Show>
                      <Show when={tk().progress.bytesTotal}>
                        <Field label={t("transfers.detail.bytes")}>
                          {formatBytes(tk().progress.bytesTotal)}
                        </Field>
                      </Show>
                      <Show when={tk().error}>
                        <Field label={t("transfers.detail.error")}>
                          <span class="whitespace-pre-wrap text-destructive">
                            {tk().error!.message}
                          </span>
                        </Field>
                      </Show>
                      <Show when={lg()?.kind === "tache"}>
                        <Field label={t("transfers.detail.raw_name")}>
                          <code class="text-xs">
                            {(lg() as { name: string }).name}
                          </code>
                        </Field>
                      </Show>
                    </dl>
                  }
                >
                  <Show when={tk().error}>
                    <p class="mt-4 whitespace-pre-wrap rounded-md bg-destructive/10 p-2 text-sm text-destructive">
                      {tk().error!.message}
                    </p>
                  </Show>
                  <SyncDetail
                    task={tk()}
                    snapshot={
                      (props.syncDetail?.legacy.kind === "sync"
                        ? props.syncDetail.legacy.snapshot
                        : undefined) ??
                      (lg() as { snapshot: SyncSnapshot }).snapshot
                    }
                    loading={props.syncDetail === undefined}
                  />
                </Show>

                <div class="mt-auto pt-6">
                  <OpenFolderButtons
                    task={tk()}
                    onOpenPath={props.onOpenPath}
                  />
                </div>
                <div class="flex justify-end gap-2 pt-3">
                  <For each={availableActions(tk())}>
                    {(a) => (
                      <Button
                        size="sm"
                        variant={a === "retry" ? "default" : "secondary"}
                        onClick={() =>
                          a === "delete"
                            ? setConfirming(true)
                            : props.onAction(tk(), a)
                        }
                      >
                        {t(`transfers.action.${a}`)}
                      </Button>
                    )}
                  </For>
                </div>
              </>
            )}
          </Show>
        </SheetContent>
      </Sheet>
      <ConfirmDeleteDialog
        open={confirming()}
        onOpenChange={setConfirming}
        onConfirm={() => {
          const tk = task()
          if (tk) props.onAction(tk, "delete")
        }}
      />
    </>
  )
}
