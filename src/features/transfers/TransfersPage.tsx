import { useSearchParams } from "@solidjs/router"
import { TbChevronDown, TbChevronRight, TbPlus } from "solid-icons/tb"
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  type JSX,
  on,
  onCleanup,
  Show,
} from "solid-js"
import { Button } from "~/components/ui/button"
import { Skeleton } from "~/components/ui/skeleton"
import { useT, useTitle } from "~/hooks"
import { me } from "~/store"
import { UserMethods } from "~/types"
import type { UnifiedTask } from "~/platform/contracts/task"
import { cn } from "~/utils/cn"
import {
  FILTER_KEYS,
  isFilterKey,
  matchesFilter,
  sectionOf,
  tacheTypesOf,
  TACHE_OPS,
  type FilterKey,
  type TaskAction,
} from "./adapter"
import { BandwidthPopover } from "./BandwidthPopover"
import { NewSyncDialog } from "./NewSyncDialog"
import { transfers } from "./service"
import { TaskCard } from "./TaskCard"
import { TaskDetail } from "./TaskDetail"

export const DONE_LIMIT = 50

const GRID =
  "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"

const Section = (props: {
  title: string
  count: number
  actions?: JSX.Element
  collapsible?: boolean
  open?: boolean
  onToggle?: () => void
  testid: string
  children: JSX.Element
}) => (
  <section data-testid={props.testid} class="flex flex-col gap-3">
    <div class="flex flex-wrap items-center gap-2">
      <Show
        when={props.collapsible}
        fallback={<h2 class="text-base font-semibold">{props.title}</h2>}
      >
        <button
          type="button"
          class="flex items-center gap-1 bg-transparent text-base font-semibold text-foreground"
          aria-expanded={props.open}
          onClick={props.onToggle}
        >
          <Show when={props.open} fallback={<TbChevronRight class="size-4" />}>
            <TbChevronDown class="size-4" />
          </Show>
          {props.title}
        </button>
      </Show>
      <span class="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
        {props.count}
      </span>
      <div class="ml-auto flex gap-2">{props.actions}</div>
    </div>
    <Show when={!props.collapsible || props.open}>{props.children}</Show>
  </section>
)

const TransfersPage = () => {
  const t = useT()
  useTitle(() => t("transfers.title"))
  const [params, setParams] = useSearchParams()
  const [newOpen, setNewOpen] = createSignal(false)
  const [doneOpen, setDoneOpen] = createSignal(false)
  const [selectedId, setSelectedId] = createSignal<string>()

  // A fast cadence while this page is open (and something is running).
  const release = transfers.watch()
  onCleanup(() => {
    release()
    transfers.openJob(undefined)
  })

  const isAdmin = () => UserMethods.is_admin(me())
  const syncOn = () => isAdmin() && transfers.syncAvailable()

  const filter = createMemo<FilterKey>(() => {
    const v = Array.isArray(params.type) ? params.type[0] : params.type
    const k = isFilterKey(v) ? v : "all"
    return k === "sync" && !syncOn() ? "all" : k
  })
  const chips = () => FILTER_KEYS.filter((k) => k !== "sync" || syncOn())

  const inFilter = createMemo(() =>
    transfers.tasks().filter((tk) => matchesFilter(tk, filter())),
  )
  const bySection = (s: "active" | "failed" | "done") =>
    inFilter().filter((tk) => sectionOf(tk.state) === s)
  const active = createMemo(() => bySection("active"))
  const failed = createMemo(() => bySection("failed"))
  const done = createMemo(() => bySection("done"))

  const history = createMemo(() => {
    const ids = new Set(transfers.tasks().map((tk) => tk.id))
    return transfers.history().filter((tk) => !ids.has(tk.id))
  })
  createEffect(
    on(filter, (f) => {
      if (f === "sync") void transfers.loadHistory()
    }),
  )

  const selected = createMemo<UnifiedTask | undefined>(() => {
    const id = selectedId()
    if (!id) return undefined
    return (
      transfers.tasks().find((tk) => tk.id === id) ??
      transfers.history().find((tk) => tk.id === id)
    )
  })

  const open = (tk: UnifiedTask) => {
    setSelectedId(tk.id)
    if (tk.legacy.kind === "sync") transfers.openJob(tk.legacy.snapshot.id)
  }
  const close = () => {
    setSelectedId(undefined)
    transfers.openJob(undefined)
  }
  const onAction = (tk: UnifiedTask, a: TaskAction) => {
    void transfers.act(tk.id, a)
  }

  const bulkTypes = () => tacheTypesOf(filter())
  const canBulk = (a: TaskAction) =>
    bulkTypes().some((ty) => TACHE_OPS[ty].includes(a))

  const cards = (list: UnifiedTask[]) => (
    <div class={GRID}>
      <For each={list}>
        {(tk) => <TaskCard task={tk} onOpen={open} onAction={onAction} />}
      </For>
    </div>
  )
  const empty = (key: string) => (
    <p class="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
      {t(`transfers.empty.${key}`)}
    </p>
  )

  return (
    <div class="mx-auto flex w-full max-w-[1600px] flex-col gap-6 p-4 sm:p-6">
      <div class="flex flex-wrap items-center gap-3">
        <h1 class="text-xl font-semibold">{t("transfers.title")}</h1>
        <Show when={syncOn()}>
          <div class="ml-auto flex flex-wrap gap-2">
            <BandwidthPopover />
            <Button
              size="sm"
              data-testid="new-sync"
              onClick={() => setNewOpen(true)}
            >
              <TbPlus class="mr-1.5 size-4" />
              {t("transfers.sync.new_job")}
            </Button>
          </div>
        </Show>
      </div>

      <div
        class="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
        role="tablist"
        aria-label="filter"
      >
        <For each={chips()}>
          {(k) => (
            <button
              type="button"
              role="tab"
              data-chip={k}
              aria-selected={filter() === k}
              class={cn(
                "shrink-0 rounded-full border px-3 py-1 text-sm text-foreground transition-colors",
                filter() === k
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-card hover:bg-accent",
              )}
              onClick={() =>
                setParams(
                  { type: k === "all" ? undefined : k },
                  { replace: true },
                )
              }
            >
              {t(`transfers.filter.${k}`)}
            </button>
          )}
        </For>
      </div>

      <Show
        when={transfers.loaded()}
        fallback={
          <div class={GRID}>
            <For each={[0, 1, 2]}>
              {() => <Skeleton class="h-28 rounded-xl" />}
            </For>
          </div>
        }
      >
        <Section
          testid="section-active"
          title={t("transfers.section.active")}
          count={active().length}
        >
          <Show when={active().length > 0} fallback={empty("active")}>
            {cards(active())}
          </Show>
        </Section>

        <Show when={failed().length > 0}>
          <Section
            testid="section-failed"
            title={t("transfers.section.failed")}
            count={failed().length}
            actions={
              <Show when={canBulk("retry_failed")}>
                <Button
                  size="sm"
                  variant="outline"
                  data-testid="retry-failed"
                  onClick={() =>
                    void transfers.actBulk(filter(), "retry_failed")
                  }
                >
                  {t("transfers.action.retry_failed")}
                </Button>
              </Show>
            }
          >
            {cards(failed())}
          </Section>
        </Show>

        <Section
          testid="section-done"
          title={t("transfers.section.done")}
          count={done().length}
          collapsible
          open={doneOpen()}
          onToggle={() => setDoneOpen(!doneOpen())}
          actions={
            <Show when={canBulk("clear_done")}>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void transfers.actBulk(filter(), "clear_done")}
              >
                {t("transfers.action.clear_done")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  void transfers.actBulk(filter(), "clear_succeeded")
                }
              >
                {t("transfers.action.clear_succeeded")}
              </Button>
            </Show>
          }
        >
          <Show when={done().length > 0} fallback={empty("done")}>
            {cards(done().slice(0, DONE_LIMIT))}
          </Show>
        </Section>

        <Show when={filter() === "sync"}>
          <Section
            testid="section-history"
            title={t("transfers.section.history")}
            count={history().length}
          >
            <Show when={history().length > 0} fallback={empty("history")}>
              {cards(history())}
            </Show>
          </Section>
        </Show>
      </Show>

      <TaskDetail
        task={selected()}
        syncDetail={transfers.detail()}
        onClose={close}
        onAction={onAction}
      />
      <Show when={syncOn()}>
        <NewSyncDialog
          open={newOpen()}
          onOpenChange={setNewOpen}
          onCreated={(snap) => {
            void transfers.refresh({ full: false }).then(() => {
              setSelectedId(`sync:${snap.id}`)
              transfers.openJob(snap.id)
            })
          }}
        />
      </Show>
    </div>
  )
}

export default TransfersPage
