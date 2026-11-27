// The app's one kind of toast (plan §P4: "toast 统一成一套"), what notify
// shows. It comes in and leaves on Motion (toastMotion, MotionTokens) through
// our presence. Not Kobalte's Toast: its root has no forceMount and unmounts
// once solid-presence sees no CSS animation (@kobalte/core 0.13.14
// chunk/6TDKM7BK.jsx:466,641), so a Motion exit never played.
//
// The behaviour is copied, not designed here (decided 11-27). References:
//   [S]  sonner v2.0.8 (6739aca5) src/index.tsx, src/styles.css, src/hooks.tsx
//   [K]  @kobalte/core 0.13.14 dist/chunk/6TDKM7BK.jsx (toast-list, -region, -root)
// Durations and curves come only from MotionTokens (tokens.css carries the
// same values for the CSS transitions).
import {
  TbAlertCircle,
  TbAlertTriangle,
  TbCircleCheck,
  TbInfoCircle,
  TbX,
} from "solid-icons/tb"
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  on,
  onCleanup,
  onMount,
  Show,
  type Accessor,
  type JSX,
} from "solid-js"
import { createStore, produce } from "solid-js/store"
import { Dynamic } from "solid-js/web"
import { useT } from "~/hooks/useT"
import {
  createPresence,
  motion,
  MotionTokens,
  toastMotion,
  type MotionKeyframes,
  type MotionOptions,
} from "~/platform/motion"
import { cn } from "~/utils/cn"

export type ToastKind = "success" | "error" | "info" | "warning"

export interface ToastOptions {
  kind?: ToastKind
  title: JSX.Element
  description?: JSX.Element
  /** One action (Undo): runs, and the toast closes. */
  action?: { label: string; onClick: () => void }
  /** Milliseconds on screen; DURATION when not given. */
  duration?: number
  /** Stays until closed. */
  persistent?: boolean
}

interface Entry extends ToastOptions {
  id: number
  open: boolean
}

/** [S] index.tsx:31 TOAST_LIFETIME. */
const DURATION = 4000
/** [S] index.tsx:22 VISIBLE_TOASTS_AMOUNT: more stay in the list, out of sight. */
const VISIBLE = 3
/** [S] index.tsx:37 GAP, between toasts spread out and the peek of those behind. */
const GAP = 14
/** [S] index.tsx:40 SWIPE_THRESHOLD and :348, the flick that is enough. */
const SWIPE_THRESHOLD = 45
const SWIPE_VELOCITY = 0.11
/** [S] index.tsx:49-61 for "bottom-right": down and to the right. */
const SWIPE_DIRECTIONS = ["bottom", "right"] as const
/** [S] index.tsx:609 and [K] 6TDKM7BK.jsx:330, the same default. */
const HOTKEY = ["altKey", "KeyT"]
/** [K] 6TDKM7BK.jsx:367: "alt+T". */
const HOTKEY_LABEL = HOTKEY.join("+").replace(/Key/g, "").replace(/Digit/g, "")

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

/** What the stack around a toast is doing; the region owns it. */
interface Stack {
  index: Accessor<number>
  expanded: Accessor<boolean>
  paused: Accessor<boolean>
  /** The heights of the toasts in front of this one, and the front one's. */
  before: Accessor<number>
  frontHeight: Accessor<number | undefined>
  measure: (h: number) => void
  /** A press on the toast: the stack's timers wait until it is let go. */
  interacting: (on: boolean) => void
}

const ToastItem = (props: { entry: Entry; stack: Stack }) => {
  const t = useT()
  const e = props.entry
  const s = props.stack
  const kind = e.kind ?? "info"
  const titleId = `toast-${e.id}-title`
  const descId = `toast-${e.id}-desc`

  // a swipe that took it away leaves in its own direction ([S] styles.css
  // :384-425, to 100% of its width or height past where it was let go)
  let swipeOut: { x: number; y: number; dir: "x" | "y" } | undefined
  const exitKeyframes = (): readonly [MotionKeyframes, MotionOptions] => {
    if (!swipeOut) return toastMotion.exit
    const { x, y, dir } = swipeOut
    const to =
      dir === "x"
        ? `translate(calc(${x}px ${x < 0 ? "-" : "+"} 100%), 0px)`
        : `translate(0px, calc(${y}px ${y < 0 ? "-" : "+"} 100%))`
    return [
      { transform: [`translate(${x}px, ${y}px)`, to], opacity: [1, 0] },
      toastMotion.exit[1],
    ]
  }
  const p = createPresence(() => props.entry.open)
  createEffect(on(p.present, (v) => !v && remove(e.id), { defer: true }))

  // [K] 6TDKM7BK.jsx:483-500 (start, pause with what is left, resume) and
  // :610-631 (the region's pause drives it; a toast starts unless paused)
  let timer: ReturnType<typeof setTimeout> | undefined
  let left = e.duration ?? DURATION
  let started = 0
  const start = () => {
    if (e.persistent || !props.entry.open) return
    clearTimeout(timer)
    started = Date.now()
    timer = setTimeout(() => dismiss(e.id), left)
  }
  const pause = () => {
    if (timer === undefined) return
    clearTimeout(timer)
    timer = undefined
    left -= Date.now() - started
  }
  createEffect(on(s.paused, (paused) => (paused ? pause() : start())))
  onCleanup(() => clearTimeout(timer))

  let li!: HTMLLIElement
  let body!: HTMLDivElement
  onMount(() => {
    if (typeof ResizeObserver === "undefined") return
    const ro = new ResizeObserver(() => s.measure(body.offsetHeight))
    ro.observe(body)
    onCleanup(() => ro.disconnect())
  })

  // [S] index.tsx:315-427: the swipe. The direction locks after the first
  // pixel; toward a direction that does not dismiss it is dampened, not
  // blocked; let go past the threshold, or flicked, it leaves; else it goes
  // back. A press on a button is a press, not a swipe (:322).
  let pointerStart: { x: number; y: number } | null = null
  let dragStart = 0
  let dir: "x" | "y" | null = null
  let amount = { x: 0, y: 0 }
  const [swiping, setSwiping] = createSignal(false)
  // moved at all: no text selection from here ([S] index.tsx:420-422,
  // styles.css:354-357)
  const [swiped, setSwiped] = createSignal(false)
  const dampen = (d: number) => d * (1 / (1.5 + Math.abs(d) / 20))
  const allowed = (d: number, axis: "x" | "y") =>
    (SWIPE_DIRECTIONS as readonly string[]).includes(
      axis === "x" ? (d > 0 ? "right" : "left") : d > 0 ? "bottom" : "top",
    )
  const onPointerDown = (ev: PointerEvent) => {
    if (ev.button === 2) return
    dragStart = Date.now()
    const target = ev.target as HTMLElement
    target.setPointerCapture?.(ev.pointerId)
    s.interacting(true)
    if (target.closest("button")) return
    setSwiping(true)
    pointerStart = { x: ev.clientX, y: ev.clientY }
  }
  const onPointerMove = (ev: PointerEvent) => {
    if (!pointerStart) return
    if ((window.getSelection()?.toString().length ?? 0) > 0) return
    const dx = ev.clientX - pointerStart.x
    const dy = ev.clientY - pointerStart.y
    if (!dir && (Math.abs(dx) > 1 || Math.abs(dy) > 1))
      dir = Math.abs(dx) > Math.abs(dy) ? "x" : "y"
    amount = {
      x: dir === "x" ? (allowed(dx, "x") ? dx : dampen(dx)) : 0,
      y: dir === "y" ? (allowed(dy, "y") ? dy : dampen(dy)) : 0,
    }
    if (amount.x || amount.y) setSwiped(true)
    li.style.transform = `translate(${amount.x}px, ${amount.y}px)`
  }
  const onPointerUp = () => {
    s.interacting(false)
    if (!pointerStart) return
    pointerStart = null
    setSwiping(false)
    setSwiped(false)
    const d = dir
    dir = null
    if (!d) return
    const a = d === "x" ? amount.x : amount.y
    const velocity = Math.abs(a) / Math.max(1, Date.now() - dragStart)
    // the click that ends a drag is not a click ([K] 6TDKM7BK.jsx:600-602)
    li.addEventListener("click", (c) => c.preventDefault(), { once: true })
    if (
      allowed(a, d) &&
      (Math.abs(a) >= SWIPE_THRESHOLD || velocity > SWIPE_VELOCITY)
    ) {
      swipeOut = { ...amount, dir: d }
      dismiss(e.id)
      return
    }
    const back = motion.animate(
      li,
      { transform: [null, "translate(0px, 0px)"] },
      MotionTokens.options.itemMove,
    )
    void back.finished.then(() => li.style.removeProperty("transform"))
    amount = { x: 0, y: 0 }
  }

  // [S] styles.css:297-300, :319, :324-325: spread out, each toast sits above
  // the ones in front of it; stacked, those behind peek out GAP apart, a
  // little smaller each (1 - 0.05 per place) and as tall as the front one,
  // their content hidden (:315). Kept apart from `transform`, which the
  // entrance, the exit and the swipe use.
  const behind = () => !s.expanded() && s.index() > 0
  const lift = () =>
    s.expanded() ? s.before() + s.index() * GAP : s.index() * GAP
  return (
    <Show when={p.present()}>
      <li
        ref={(el) => {
          li = el
          p.part({
            enter: toastMotion.enter,
            get exit() {
              return exitKeyframes()
            },
          })(el)
        }}
        data-motion="toast"
        data-toast-kind={kind}
        data-duration={
          e.persistent ? undefined : String(e.duration ?? DURATION)
        }
        data-index={s.index()}
        data-front={String(s.index() === 0)}
        data-visible={String(s.index() + 1 <= VISIBLE)}
        data-swiping={String(swiping())}
        data-swiped={String(swiped())}
        // [K] 6TDKM7BK.jsx:657-670
        role="status"
        tabIndex={0}
        aria-live={kind === "error" ? "assertive" : "polite"}
        aria-atomic="true"
        aria-labelledby={titleId}
        aria-describedby={e.description ? descId : undefined}
        onKeyDown={(ev) => {
          // [K] 6TDKM7BK.jsx:501-510
          if (ev.key === "Escape") dismiss(e.id)
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        class={cn(
          "pointer-events-auto absolute inset-x-0 bottom-0 m-0 overflow-hidden rounded-lg border bg-popover text-sm text-popover-foreground shadow-lg",
          "origin-bottom touch-none transition-[translate,scale,height] duration-(--motion-item-move) ease-standard",
          // the opacity is the entrance's and exit's, so those out of sight
          // are hidden by visibility ([S] styles.css:319 uses opacity)
          s.index() + 1 > VISIBLE && "invisible pointer-events-none",
          swiped() && "select-none",
        )}
        style={{
          translate: `0 ${-lift()}px`,
          scale: behind() ? String(1 - 0.05 * s.index()) : "1",
          height:
            behind() && s.frontHeight() !== undefined
              ? `${s.frontHeight()}px`
              : undefined,
          // [S] index.tsx:303: the newest on top
          "z-index": String(100 - s.index()),
        }}
      >
        <div
          ref={body}
          class={cn(
            "flex w-full items-start gap-3 p-3 transition-opacity duration-(--motion-crossfade) ease-standard",
            behind() && "opacity-0",
          )}
        >
          <Dynamic
            component={ICONS[kind]}
            class={cn("mt-0.5 size-5 shrink-0", TONES[kind])}
            aria-hidden="true"
          />
          <div class="min-w-0 flex-1">
            <div id={titleId} data-toast-title class="break-words font-medium">
              {e.title}
            </div>
            <Show when={e.description}>
              <div id={descId} class="mt-0.5 break-words text-muted-foreground">
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
        </div>
      </li>
    </Show>
  )
}

/**
 * Where toasts show: bottom right, the newest in front; on a phone across the
 * bottom ([S] styles.css:430-462 below 601px), over the tab bar (`bottom`).
 */
export const ToastRegion = (props: { bottom?: string }) => {
  const t = useT()
  let list!: HTMLOListElement
  // [S] index.tsx:640-641, hooks.tsx (document hidden); [K] 6TDKM7BK.jsx
  // :136-147 (focus in the list holds the timers too)
  const [expanded, setExpanded] = createSignal(false)
  const [interacting, setInteracting] = createSignal(false)
  const [focusWithin, setFocusWithin] = createSignal(false)
  const [hidden, setHidden] = createSignal(
    typeof document !== "undefined" && document.hidden,
  )
  // [S] index.tsx:234
  const paused = () => expanded() || interacting() || focusWithin() || hidden()
  const [heights, setHeights] = createStore<Record<number, number>>({})

  /** Newest first ([S] index.tsx:692 puts a new toast in front). */
  const shown = createMemo(() => [...entries].reverse())
  const heightOf = (e: Entry) => heights[e.id] ?? 0
  const frontHeight = () => {
    const f = shown()[0]
    return f && heights[f.id] !== undefined ? heights[f.id] : undefined
  }
  const listHeight = () => {
    const list = shown().slice(0, VISIBLE)
    if (!list.length || frontHeight() === undefined) return undefined
    if (!expanded()) return frontHeight()! + GAP * (list.length - 1)
    return (
      list.reduce((sum, e) => sum + heightOf(e), 0) + GAP * (list.length - 1)
    )
  }

  // [S] index.tsx:744-749: one toast or none, nothing to spread out
  createEffect(
    on(
      () => shown().length,
      (n) => n <= 1 && setExpanded(false),
    ),
  )
  // [S] hooks.tsx: the page out of sight holds the timers
  const onVisibility = () => setHidden(document.hidden)
  document.addEventListener("visibilitychange", onVisibility)
  // [S] index.tsx:751-770 and [K] 6TDKM7BK.jsx:160-180: the hotkey spreads
  // the toasts out and takes the focus there; Escape in them folds them
  const onKey = (ev: KeyboardEvent) => {
    const pressed = HOTKEY.every(
      (k) => (ev as unknown as Record<string, unknown>)[k] || ev.code === k,
    )
    if (pressed && shown().length) {
      setExpanded(true)
      list.focus({ preventScroll: true })
    }
    if (ev.code === "Escape" && list.contains(document.activeElement))
      setExpanded(false)
  }
  document.addEventListener("keydown", onKey)
  // [S] index.tsx:654-655, :772-782, :821-840: where the focus came from, to
  // give it back when it leaves the toasts
  let lastFocused: HTMLElement | null = null
  let focusInside = false
  onCleanup(() => {
    document.removeEventListener("visibilitychange", onVisibility)
    document.removeEventListener("keydown", onKey)
    lastFocused?.focus({ preventScroll: true })
  })

  return (
    <div
      // [K] 6TDKM7BK.jsx:369-372, :389-396 (label "Notifications (alt+T)",
      // out of the tab order, takes the pointer only with toasts in it)
      role="region"
      tabIndex={-1}
      aria-label={`${t("global.notifications")} (${HOTKEY_LABEL})`}
      // [S] index.tsx:25, :28, :34: 24px from the edges and 356px wide;
      // 16px from them on a phone. Above everything, hope's tooltips too
      // (the layer hope's own toasts had, app/theme.ts)
      class="pointer-events-none fixed inset-x-4 z-[1800] [--toast-offset:16px] min-[601px]:left-auto min-[601px]:right-6 min-[601px]:w-[356px] min-[601px]:[--toast-offset:24px]"
      style={{
        bottom: `calc(${props.bottom ?? "0px"} + env(safe-area-inset-bottom) + var(--toast-offset))`,
      }}
    >
      <ol
        ref={list}
        data-toast-region
        data-expanded={String(expanded())}
        tabIndex={-1}
        class="relative m-0 list-none p-0 outline-none"
        style={{
          height: listHeight() !== undefined ? `${listHeight()}px` : undefined,
          "pointer-events": shown().length ? "auto" : "none",
        }}
        // [S] index.tsx:841-857
        onMouseEnter={() => setExpanded(true)}
        onMouseMove={() => setExpanded(true)}
        onMouseLeave={() => !interacting() && setExpanded(false)}
        onPointerUp={() => setInteracting(false)}
        // [K] 6TDKM7BK.jsx:136-147 with [S] index.tsx:821-840
        onFocusIn={(ev) => {
          setFocusWithin(true)
          if (!focusInside) {
            focusInside = true
            lastFocused = ev.relatedTarget as HTMLElement | null
          }
        }}
        onFocusOut={(ev) => {
          if (list.contains(ev.relatedTarget as Node | null)) return
          setFocusWithin(false)
          if (focusInside) {
            focusInside = false
            lastFocused?.focus({ preventScroll: true })
            lastFocused = null
          }
        }}
      >
        <For each={shown()}>
          {(entry) => {
            const index = () => shown().indexOf(entry)
            onCleanup(() =>
              setHeights(
                produce((h) => {
                  delete h[entry.id]
                }),
              ),
            )
            return (
              <ToastItem
                entry={entry}
                stack={{
                  index,
                  expanded,
                  paused,
                  before: () =>
                    shown()
                      .slice(0, index())
                      .reduce((sum, e) => sum + heightOf(e), 0),
                  frontHeight,
                  measure: (h) => setHeights(entry.id, h),
                  interacting: setInteracting,
                }}
              />
            )
          }}
        </For>
      </ol>
    </div>
  )
}
