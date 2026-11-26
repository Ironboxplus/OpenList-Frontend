import { createSignal } from "solid-js"
import { clampNavWidth, NAV_MIN, NAV_STEP } from "./nav-width"

export interface NavResizerProps {
  /** Current width of the nav, px. */
  width: number
  max: number
  label: string
  /** id of the nav it resizes. */
  controls: string
  /** Every change while dragging (done: false); done: true when it is to be kept. */
  onResize: (width: number, done: boolean) => void
  onDragging?: (dragging: boolean) => void
}

/**
 * The handle on the side nav's right edge: drag it, or focus it and use the
 * arrow keys (Home / End for the narrowest / widest), to set the nav's width;
 * double-click returns to the default. A WAI-ARIA window splitter
 * (https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/), its value in px.
 * It is fixed, not inside the nav, so the nav's own scrolling does not move it.
 */
export const NavResizer = (props: NavResizerProps) => {
  const [dragging, setDragging] = createSignal(false)
  let startX = 0
  let startWidth = 0
  const set = (w: number, done: boolean) =>
    props.onResize(clampNavWidth(w, props.max), done)
  const drag = (on: boolean) => {
    setDragging(on)
    props.onDragging?.(on)
  }
  const end = () => {
    if (!dragging()) return
    drag(false)
    set(props.width, true)
  }
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={props.label}
      aria-controls={props.controls}
      aria-valuenow={props.width}
      aria-valuemin={NAV_MIN}
      aria-valuemax={props.max}
      tabindex="0"
      class="group fixed z-[1201] w-2 -translate-x-1/2 cursor-col-resize touch-none outline-none"
      style={{
        top: "var(--shell-header)",
        left: `calc(var(--shell-left) + ${props.width}px)`,
        height: "calc(100dvh - var(--shell-header) - var(--shell-gap))",
      }}
      onPointerDown={(e) => {
        if (e.button !== 0) return
        // no text selection while dragging
        e.preventDefault()
        e.currentTarget.setPointerCapture(e.pointerId)
        startX = e.clientX
        startWidth = props.width
        drag(true)
      }}
      onPointerMove={(e) => {
        if (dragging()) set(startWidth + e.clientX - startX, false)
      }}
      onPointerUp={end}
      onPointerCancel={end}
      onLostPointerCapture={end}
      onDblClick={() => set(NAV_MIN, true)}
      onKeyDown={(e) => {
        const to =
          e.key === "ArrowRight"
            ? props.width + NAV_STEP
            : e.key === "ArrowLeft"
              ? props.width - NAV_STEP
              : e.key === "Home"
                ? NAV_MIN
                : e.key === "End"
                  ? props.max
                  : undefined
        if (to === undefined) return
        e.preventDefault()
        set(to, true)
      }}
    >
      <div
        class="mx-auto h-full w-0.5 rounded-full transition-colors"
        classList={{
          "bg-primary": dragging(),
          "group-hover:bg-border group-focus-visible:bg-primary": !dragging(),
        }}
      />
    </div>
  )
}
