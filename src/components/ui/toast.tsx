// The app's one kind of toast (plan §P4: "toast 统一成一套"), what notify
// shows. It comes in and leaves on Motion (200ms/150ms, toastMotion) through
// our presence. Not Kobalte's Toast: its root has no forceMount and unmounts
// once solid-presence sees no CSS animation (@kobalte/core 0.13.14
// chunk/6TDKM7BK.jsx:466,641), so a Motion exit never played. An error
// interrupts (assertive); the rest wait their turn (polite). Pointing at a
// toast, or focusing in it, holds its timer.
import {
  TbAlertCircle,
  TbAlertTriangle,
  TbCircleCheck,
  TbInfoCircle,
  TbX,
} from "solid-icons/tb"
import {
  createEffect,
  For,
  on,
  onCleanup,
  onMount,
  Show,
  type JSX,
} from "solid-js"
import { createStore, produce } from "solid-js/store"
import { Dynamic } from "solid-js/web"
import { useT } from "~/hooks/useT"
import { createPresence, toastMotion } from "~/platform/motion"
import { cn } from "~/utils/cn"

export type ToastKind = "success" | "error" | "info" | "warning"

export interface ToastOptions {
  kind?: ToastKind
  title: JSX.Element
  description?: JSX.Element
  /** One action (Undo): runs, and the toast closes. */
  action?: { label: string; onClick: () => void }
  /** Milliseconds on screen; 3000 when not given. */
  duration?: number
  /** Stays until closed. */
  persistent?: boolean
}

interface Entry extends ToastOptions {
  id: number
  open: boolean
}

const DURATION = 3000
const [entries, setEntries] = createStore<Entry[]>([])
let seq = 0

const show = (o: ToastOptions) => {
  const id = ++seq
  setEntries(entries.length, { ...o, id, open: true })
  return id
}
const dismiss = (id: number) => setEntries((e) => e.id === id, "open", false)
const remove = (id: number) =>
  setEntries(
    produce((list) => {
      const i = list.findIndex((e) => e.id === id)
      if (i >= 0) list.splice(i, 1)
    }),
  )

export const toast = {
  show,
  dismiss,
  /** Takes every toast away at once (tests). */
  clear: () => setEntries([]),
}

const ICONS: Record<ToastKind, typeof TbInfoCircle> = {
  success: TbCircleCheck,
  error: TbAlertCircle,
  info: TbInfoCircle,
  warning: TbAlertTriangle,
}
const TONES: Record<ToastKind, string> = {
  success: "text-success",
  error: "text-destructive",
  info: "text-primary",
  warning: "text-warning",
}

const ToastItem = (props: { entry: Entry }) => {
  const t = useT()
  const e = props.entry
  const kind = e.kind ?? "info"
  const duration = e.duration ?? DURATION
  const p = createPresence(() => props.entry.open)
  createEffect(on(p.present, (v) => !v && remove(e.id), { defer: true }))

  let timer: ReturnType<typeof setTimeout> | undefined
  let left = duration
  let started = 0
  const run = () => {
    if (e.persistent || timer || !props.entry.open) return
    started = Date.now()
    timer = setTimeout(() => dismiss(e.id), left)
  }
  const hold = () => {
    if (!timer) return
    clearTimeout(timer)
    timer = undefined
    left = Math.max(0, left - (Date.now() - started))
  }
  onMount(run)
  onCleanup(hold)

  return (
    <Show when={p.present()}>
      <li
        ref={p.part(toastMotion)}
        data-motion="toast"
        data-toast-kind={kind}
        data-duration={e.persistent ? undefined : String(duration)}
        role={kind === "error" ? "alert" : "status"}
        aria-live={kind === "error" ? "assertive" : "polite"}
        aria-atomic="true"
        onPointerEnter={hold}
        onPointerLeave={run}
        onFocusIn={hold}
        onFocusOut={run}
        class="pointer-events-auto flex w-full items-start gap-3 rounded-lg border bg-popover p-3 text-sm text-popover-foreground shadow-lg"
      >
        <Dynamic
          component={ICONS[kind]}
          class={cn("mt-0.5 size-5 shrink-0", TONES[kind])}
          aria-hidden="true"
        />
        <div class="min-w-0 flex-1">
          <div class="break-words font-medium">{e.title}</div>
          <Show when={e.description}>
            <div class="mt-0.5 break-words text-muted-foreground">
              {e.description}
            </div>
          </Show>
        </div>
        <Show when={e.action}>
          {(a) => (
            <button
              type="button"
              data-testid="toast-action"
              class="-my-1 inline-flex h-8 shrink-0 items-center rounded-md border-0 bg-transparent px-2.5 font-medium text-primary hover:bg-accent"
              onClick={() => {
                dismiss(e.id)
                a().onClick()
              }}
            >
              {a().label}
            </button>
          )}
        </Show>
        <button
          type="button"
          data-testid="toast-close"
          aria-label={t("global.close")}
          title={t("global.close")}
          class="-m-1 inline-flex size-8 shrink-0 items-center justify-center rounded-md border-0 bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground"
          onClick={() => dismiss(e.id)}
        >
          <TbX class="size-4" />
        </button>
      </li>
    </Show>
  )
}

/**
 * Where toasts show: bottom right, the newest last; on a phone across the
 * bottom, over the tab bar (`bottom`).
 */
export const ToastRegion = (props: { bottom?: string }) => {
  const t = useT()
  return (
    <ol
      data-toast-region
      aria-label={t("global.notifications")}
      class="pointer-events-none fixed inset-x-3 z-[1700] m-0 flex list-none flex-col items-stretch gap-2 p-0 sm:left-auto sm:right-4 sm:w-96"
      style={{
        bottom: `calc(${props.bottom ?? "0px"} + env(safe-area-inset-bottom) + 0.75rem)`,
      }}
    >
      <For each={entries}>{(entry) => <ToastItem entry={entry} />}</For>
    </ol>
  )
}
