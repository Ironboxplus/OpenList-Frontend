// Small pieces the prototype's screens share, on the kit (src/components/ui).
import { createRoot, type JSX } from "solid-js"
import { Button } from "~/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip"
import { createViewport } from "~/features/shell/viewport"
import { cn } from "~/utils/cn"

/** Menus open in 120ms and close in 90ms (02 §三, 菜单/下拉). */
export const MENU_MOTION =
  "duration-(--motion-menu-open) data-[closed]:duration-(--motion-menu-close)"

/** Dialogs: 200ms in, 150ms out, a fade and a 95% scale, no slide (02 §三). */
export const DIALOG_MOTION =
  "duration-(--motion-dialog-open) data-[closed]:duration-(--motion-dialog-close) ease-emph-decel data-[closed]:ease-emph-accel data-[expanded]:animate-in data-[closed]:animate-out fade-in-0 fade-out-0 zoom-in-95 zoom-out-95"

/** An icon-only button: its name is the tooltip and the accessible label. */
export const IconButton = (props: {
  label: string
  children: JSX.Element
  class?: string
  onClick?: (e: MouseEvent) => void
  disabled?: boolean
  onDark?: boolean
  testid?: string
}) => (
  <Tooltip openDelay={500}>
    <TooltipTrigger
      as={Button}
      variant="ghost"
      size="icon"
      aria-label={props.label}
      data-testid={props.testid}
      disabled={props.disabled}
      onClick={(e: MouseEvent) => props.onClick?.(e)}
      class={cn(
        "shrink-0 [&_svg]:size-5",
        props.onDark && "text-white hover:bg-white/15 hover:text-white",
        props.class,
      )}
    >
      {props.children}
    </TooltipTrigger>
    <TooltipContent>{props.label}</TooltipContent>
  </Tooltip>
)

export const formatSize = (n: number) => {
  if (n < 1024) return `${n} B`
  const u = ["KB", "MB", "GB", "TB"]
  let v = n / 1024
  let i = 0
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024
    i++
  }
  return `${v < 10 ? v.toFixed(1) : Math.round(v)} ${u[i]}`
}

export const formatTime = (s: string) => {
  const d = new Date(s)
  if (isNaN(d.getTime())) return ""
  const p = (x: number) => String(x).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

/** The shell's three tiers (src/features/shell/viewport.ts), one per page. */
export const viewport = createRoot(() => createViewport())
export const isPhone = () => viewport() === "phone"
