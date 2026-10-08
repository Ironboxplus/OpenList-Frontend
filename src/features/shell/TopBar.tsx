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

export const TOP_BAR_HEIGHT = "2.75rem"

/**
 * Page title on the left; search and (tablet/desktop only, the phone has the
 * Task Center in its tab bar flow) Task Center buttons on the right.
 */
export const TopBar = (props: { pathname: string; phone?: boolean }) => {
  const t = useT()
  const title = () => {
    const id = activeNavId(props.pathname)
    const item = NAV_ITEMS.find((i) => i.id === id)
    return item ? t(item.labelKey) : ""
  }
  return (
    <header
      class="flex items-center justify-between px-4"
      style={{ height: TOP_BAR_HEIGHT }}
    >
      <Show when={title()} fallback={<span />}>
        <span class="text-sm font-medium text-muted-foreground">{title()}</span>
      </Show>
      <div class="flex items-center gap-1">
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
