import type { TooltipRootProps } from "@kobalte/core/tooltip"
import { children, createRenderEffect, type JSX, Show } from "solid-js"
import { spread } from "solid-js/web"
import {
  Tooltip as UiTooltip,
  TooltipArrow,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip"

/**
 * Kobalte's trigger without an element of its own: the props Kobalte gives
 * its trigger (ref, pointer and focus handlers, aria) are put on the DOM node
 * of the child, as hope's Tooltip does (it resolves `children()` and
 * attaches its listeners to that node, @hope-ui/solid dist 14875-14989). The
 * child keeps its place and its parent; the tooltip is anchored on it.
 */
const OnChild = (
  props: Record<string, unknown> & { children?: JSX.Element },
) => {
  const resolved = children(() => props.children)
  const node = () => {
    let el: unknown = resolved()
    while (typeof el === "function") el = (el as () => unknown)()
    return el instanceof Element ? el : undefined
  }
  // Only what Kobalte adds for the trigger; never class, style or type,
  // which belong to the child.
  const picked: Record<string, unknown> = {}
  for (const key of Object.keys(props)) {
    if (
      key === "ref" ||
      /^on[A-Z]/.test(key) ||
      key.startsWith("aria-") ||
      key.startsWith("data-")
    )
      Object.defineProperty(picked, key, {
        get: () => props[key],
        enumerable: true,
      })
  }
  createRenderEffect(() => {
    const el = node()
    if (el) spread(el, picked, el instanceof SVGElement, true)
  })
  return resolved as unknown as JSX.Element
}

export interface TooltipProps {
  label: JSX.Element
  withArrow?: boolean
  placement?: TooltipRootProps["placement"]
  disabled?: boolean
  /** One element: the tooltip attaches to it, no wrapper is added. */
  children: JSX.Element
}

/**
 * hope-ui's Tooltip API on the kit's Tooltip (Kobalte): hover or focus the
 * child; Kobalte's delays (700/300), as the shell's tooltips; 8px off the
 * child, as hope.
 */
export const Tooltip = (props: TooltipProps) => (
  <UiTooltip
    placement={props.placement ?? "bottom"}
    gutter={8}
    disabled={props.disabled}
  >
    <TooltipTrigger as={OnChild}>{props.children}</TooltipTrigger>
    <TooltipContent>
      {props.label}
      <Show when={props.withArrow}>
        <TooltipArrow />
      </Show>
    </TooltipContent>
  </UiTooltip>
)
