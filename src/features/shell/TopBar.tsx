import { focusRing } from "~/components/ui/focus"
import { TbBell, TbListDetails, TbSearch } from "solid-icons/tb"
import { For, Show } from "solid-js"
import { Motion } from "solid-motionone"
import { attentionRing, prefersReducedMotion } from "~/utils/motion-presets"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip"
import { useT } from "~/hooks"
import { errorCenter } from "../notifications/service"
import { setErrorCenterOpen } from "../notifications/state"
import { CountBadge, NavBadge } from "./NavBadge"
import { activeNavId, NAV_ITEMS } from "./nav-items"
import { hotkeyLabel, setPaletteOpen } from "../palette/state"
import { nudge, setTaskCenterOpen, taskCenterOpen } from "./task-center"
import { topBarSlots } from "./topbar-slot"

export const TOP_BAR_HEIGHT = "2.75rem"

/**
 * One slim bar above every signed-in page. Left: whatever the page registered
 * (breadcrumb, back button) or the section title. Right: the page's own
 * actions, then the shell's search and (tablet/desktop) Task Center buttons.
 */
export const TopBar = (props: { pathname: string; phone?: boolean }) => {
  const t = useT()
  const title = () => {
    const id = activeNavId(props.pathname)
    const item = NAV_ITEMS.find((i) => i.id === id)
    return item ? t(item.labelKey) : ""
  }
  const ctx = () => ({ phone: !!props.phone })
  // Reduced motion: no ring; the badge count still changes.
  const rings = () => (nudge() > 0 && !prefersReducedMotion() ? [nudge()] : [])
  return (
    <header
      data-topbar
      class="sticky top-[var(--shell-gap,0px)] z-[1100] flex items-center justify-between gap-2 rounded-t-[calc(var(--shell-radius,0px)-1px)] border-b bg-background/95 px-3 backdrop-blur before:pointer-events-none before:absolute before:inset-x-0 before:-top-[var(--shell-gap,0px)] before:h-[var(--shell-gap,0px)] before:bg-muted sm:px-4"
      style={{ height: TOP_BAR_HEIGHT }}
    >
      <div class="flex min-w-0 flex-1 items-center">
        <Show
          when={topBarSlots()?.left}
          fallback={
            <span class="px-1.5 text-sm font-medium text-foreground">
              {title()}
            </span>
          }
        >
          {(left) => left()(ctx())}
        </Show>
      </div>
      <div class="flex shrink-0 items-center gap-1">
        <Show when={topBarSlots()?.right}>{(right) => right()(ctx())}</Show>
        <Tooltip placement="bottom">
          <TooltipTrigger
            as="button"
            type="button"
            aria-label={t("palette.open")}
            data-palette-trigger
            onClick={() => setPaletteOpen(true)}
            class={`${focusRing} inline-flex size-9 items-center justify-center rounded-lg bg-transparent text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground`}
          >
            <TbSearch class="size-5" />
          </TooltipTrigger>
          <TooltipContent>
            {t("palette.open")} · {hotkeyLabel()}
          </TooltipContent>
        </Tooltip>
        <Show when={!props.phone}>
          <Tooltip placement="bottom">
            <TooltipTrigger
              as="button"
              type="button"
              aria-label={t("shell.error_center.open")}
              data-error-center-trigger
              onClick={() => setErrorCenterOpen(true)}
              class={`${focusRing} relative inline-flex size-9 items-center justify-center rounded-lg bg-transparent text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground`}
            >
              <TbBell class="size-5" />
              <CountBadge
                testid="error-badge"
                count={errorCenter.unreadCount()}
                label={t("shell.error_center.unread", {
                  count: errorCenter.unreadCount(),
                })}
                class="absolute -right-0.5 -top-0.5 bg-destructive text-destructive-foreground"
              />
            </TooltipTrigger>
            <TooltipContent>{t("shell.error_center.title")}</TooltipContent>
          </Tooltip>
          <Tooltip placement="bottom">
            <TooltipTrigger
              as="button"
              type="button"
              aria-label={t("shell.task_center.title")}
              aria-expanded={taskCenterOpen()}
              onClick={() => {
                setTaskCenterOpen(true)
              }}
              class={`${focusRing} relative inline-flex size-9 items-center justify-center rounded-lg bg-transparent text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground`}
            >
              <TbListDetails class="size-5" />
              {/* a new nudge value is a new item: a fresh ring mounts and plays once */}
              <For each={rings()}>
                {() => (
                  <Motion.span
                    data-testid="task-nudge"
                    aria-hidden="true"
                    class="pointer-events-none absolute inset-0 rounded-lg bg-primary/40"
                    {...(attentionRing as any)}
                  />
                )}
              </For>
              <NavBadge class="absolute -right-0.5 -top-0.5" />
            </TooltipTrigger>
            <TooltipContent>{t("shell.task_center.title")}</TooltipContent>
          </Tooltip>
        </Show>
      </div>
    </header>
  )
}
