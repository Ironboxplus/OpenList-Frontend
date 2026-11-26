// A group's rarely used settings, folded away but never hidden (§0 高级项,
// research 05 §二): the title stays, it says how many items it holds and how
// many of them are no longer at their default, and it opens with a height and
// fade (220ms in, 180ms out, the fade 40ms ahead; motion.css .proto-collapsible).
import type { JSX } from "solid-js"
import { Show } from "solid-js"
import * as Collapsible from "@kobalte/core/collapsible"
import { TbChevronRight } from "solid-icons/tb"
import { cn } from "~/utils/cn"

export const AdvancedGroup = (props: {
  title: string
  count: number
  changed: number
  open: boolean
  onOpenChange: (open: boolean) => void
  /** A heading-sized title, for a group that has nothing but these items. */
  heading?: boolean
  testid?: string
  children: JSX.Element
}) => (
  <Collapsible.Root open={props.open} onOpenChange={props.onOpenChange}>
    <Collapsible.Trigger
      data-testid={props.testid}
      class={cn(
        "flex w-full items-center gap-2 rounded-md border-0 bg-transparent px-1 py-1.5 text-left outline-none hover:bg-accent/60 focus-visible:ring-[1.5px] focus-visible:ring-ring",
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
      <span class={cn(props.heading ? "text-foreground" : "")}>
        {props.title}
      </span>
      <span class="text-xs font-normal tabular-nums text-muted-foreground">
        {props.count} 项
      </span>
      <Show when={props.changed > 0}>
        <span
          data-testid="changed-mark"
          class="ml-auto inline-flex items-center gap-1 text-xs font-normal text-primary"
        >
          <span class="size-1.5 rounded-full bg-primary" />
          已改 {props.changed} 项
        </span>
      </Show>
    </Collapsible.Trigger>
    <Collapsible.Content class="proto-collapsible" data-motion="advanced">
      <div class="proto-collapsible-body grid gap-3 pb-1 pl-7 pr-1 pt-2">
        {props.children}
      </div>
    </Collapsible.Content>
  </Collapsible.Root>
)
