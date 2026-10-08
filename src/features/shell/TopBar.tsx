import { focusRing } from "~/components/ui/focus"
import { TbListDetails, TbSearch } from "solid-icons/tb"
import { Show } from "solid-js"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip"
import { useT } from "~/hooks"
import { NavBadge } from "./NavBadge"
import { activeNavId, NAV_ITEMS } from "./nav-items"
import { hotkeyLabel, setPaletteOpen } from "../palette/state"
import { setTaskCenterOpen, taskCenterOpen } from "./task-center"
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
  return (
    <header
      data-topbar
      class="sticky top-0 z-[1100] flex items-center justify-between gap-2 border-b bg-background/95 px-3 backdrop-blur sm:px-4"
      style={{ height: TOP_BAR_HEIGHT }}
    >
      <div class="flex min-w-0 flex-1 items-center">
        <Show
          when={topBarSlots()?.left}
          fallback={
            <span class="text-sm font-medium text-muted-foreground">
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
              aria-label={t("shell.task_center.title")}
              aria-expanded={taskCenterOpen()}
              onClick={() => {
                setTaskCenterOpen(true)
              }}
              class={`${focusRing} relative inline-flex size-9 items-center justify-center rounded-lg bg-transparent text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground`}
            >
              <TbListDetails class="size-5" />
              <NavBadge class="absolute -right-0.5 -top-0.5" />
            </TooltipTrigger>
            <TooltipContent>{t("shell.task_center.title")}</TooltipContent>
          </Tooltip>
        </Show>
      </div>
    </header>
  )
}
