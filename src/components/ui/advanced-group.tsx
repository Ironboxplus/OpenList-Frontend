// A group's rarely used settings, folded away but never hidden (research 05
// §二): the title stays, it says how many items it holds and how many of them
// are no longer at their default, and it opens with the collapsible's height
// and fade. Ported from design/viewer-proto/src/AdvancedGroup.tsx.
import { TbChevronRight } from "solid-icons/tb"
import { Show, type JSX } from "solid-js"
import { useT } from "~/hooks"
import { cn } from "~/utils/cn"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./collapsible"

/**
 * Fewer items than this are not folded (the lead, 11-27: an "Advanced (1)"
 * only costs a click): they show in line, under the group's title when the
 * group has nothing else. The rule for every group, here and in P3.
 */
export const ADVANCED_MIN_ITEMS = 2

interface AdvancedGroupProps {
  title: string
  /** How many settings it holds: under ADVANCED_MIN_ITEMS they show in line. */
  count: number
  changed: number
  open: boolean
  onOpenChange: (open: boolean) => void
  /** A heading-sized title, for a group that has nothing but these items. */
  heading?: boolean
  testid?: string
  children: JSX.Element
}

export const AdvancedGroup = (props: AdvancedGroupProps) => (
  <Show
    when={props.count >= ADVANCED_MIN_ITEMS}
    fallback={
      <div class="grid gap-3">
        <Show when={props.heading}>
          <h3 class="px-1 text-sm font-semibold">{props.title}</h3>
        </Show>
        {props.children}
      </div>
    }
  >
    <Folded {...props} />
  </Show>
)

const Folded = (props: AdvancedGroupProps) => {
  const t = useT()
  return (
    <Collapsible open={props.open} onOpenChange={props.onOpenChange}>
      <CollapsibleTrigger
        data-testid={props.testid}
        class={cn(
          "flex min-h-8 w-full items-center gap-2 rounded-md border-0 bg-transparent px-1 py-1.5 text-left outline-none hover:bg-accent/60 focus-visible:ring-[1.5px] focus-visible:ring-ring",
          props.heading
            ? "text-sm font-semibold"
            : "text-sm text-muted-foreground",
        )}
      >
        <TbChevronRight
          class={cn(
            "size-4 shrink-0 transition-transform duration-(--motion-collapse-open) ease-emph-decel",
            props.open && "rotate-90",
          )}
        />
        <span class={cn(props.heading && "text-foreground")}>
          {props.title}
        </span>
        <span class="text-xs font-normal tabular-nums text-muted-foreground">
          {t("global.advanced_count", { count: props.count })}
        </span>
        <Show when={props.changed > 0}>
          <span
            data-testid="changed-mark"
            class="ml-auto inline-flex items-center gap-1 text-xs font-normal text-primary"
          >
            <span class="size-1.5 rounded-full bg-primary" />
            {t("global.advanced_changed", { count: props.changed })}
          </span>
        </Show>
      </CollapsibleTrigger>
      <CollapsibleContent bodyClass="grid gap-3 pb-1 pl-7 pr-1 pt-2">
        {props.children}
      </CollapsibleContent>
    </Collapsible>
  )
}
