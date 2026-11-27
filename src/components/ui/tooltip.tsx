// Copied from shadcn-solid (hngngn/shadcn-solid) tag shadcn-solid@0.7.0
// (commit 08b8ce27d80b289fe983051a14541ff53e08d9cb), registry/frameworks/tailwindcss/.
// The CLI is not used offline-first; imports were adapted to this repo's alias.
import { cn } from "~/utils/cn"
import type { PolymorphicProps } from "@kobalte/core/polymorphic"
import * as TooltipPrimitive from "@kobalte/core/tooltip"
import { type ValidComponent, mergeProps, splitProps } from "solid-js"
import { OverlayPresence, withRef } from "./overlay-presence"

export const TooltipTrigger = TooltipPrimitive.Trigger
/** Kobalte's arrow, pointing at the trigger; put it inside TooltipContent. */
export const TooltipArrow = TooltipPrimitive.Arrow

export const Tooltip = (props: TooltipPrimitive.TooltipRootProps) => {
  const merge = mergeProps<TooltipPrimitive.TooltipRootProps[]>(
    // forceMount: our presence unmounts the content after its exit (overlay-presence.tsx)
    { gutter: 4, forceMount: true },
    props,
  )

  return <TooltipPrimitive.Root {...merge} />
}

type TooltipContentProps = TooltipPrimitive.TooltipContentProps & {
  class?: string
  ref?: unknown
}

export const TooltipContent = <T extends ValidComponent = "div">(
  props: PolymorphicProps<T, TooltipContentProps>,
) => {
  const [local, rest] = splitProps(props as TooltipContentProps, [
    "class",
    "ref",
  ])
  const tooltip = TooltipPrimitive.useTooltipContext()

  return (
    <OverlayPresence open={tooltip.isOpen} kind="tooltip">
      {(ref) => (
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            data-motion="tooltip"
            ref={withRef(ref, local.ref)}
            class={cn(
              "z-[1540] origin-[var(--kb-tooltip-content-transform-origin)] overflow-hidden rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground",
              local.class,
            )}
            {...rest}
          />
        </TooltipPrimitive.Portal>
      )}
    </OverlayPresence>
  )
}
