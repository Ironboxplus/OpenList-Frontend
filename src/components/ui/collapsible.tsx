// A section that folds away (research 05 §二.3): the height opens in 220ms on
// the emphasized-decelerate curve and closes in 180ms on the accelerate one,
// and the content fades 40ms ahead of the height. Kobalte keeps the content
// mounted (forceMount) so a search can still find what is folded; folded, it
// is hidden and inert. Reduced motion keeps only the fade (MotionDriver).
import * as CollapsiblePrimitive from "@kobalte/core/collapsible"
import type { PolymorphicProps } from "@kobalte/core/polymorphic"
import {
  createEffect,
  on,
  onCleanup,
  onMount,
  splitProps,
  type JSX,
  type ValidComponent,
} from "solid-js"
import { motion, MotionTokens, type MotionControl } from "~/platform/motion"
import { cn } from "~/utils/cn"
import { withRef } from "./overlay-presence"

export const Collapsible = ((
  props: CollapsiblePrimitive.CollapsibleRootProps,
) => (
  <CollapsiblePrimitive.Root forceMount {...props} />
)) as typeof CollapsiblePrimitive.Root
export const CollapsibleTrigger = CollapsiblePrimitive.Trigger

type CollapsibleContentProps = CollapsiblePrimitive.CollapsibleContentProps & {
  class?: string
  /** Classes of the inner box that fades (padding, gaps). */
  bodyClass?: string
  children?: JSX.Element
  ref?: unknown
}

export const CollapsibleContent = <T extends ValidComponent = "div">(
  props: PolymorphicProps<T, CollapsibleContentProps>,
) => {
  const [local, rest] = splitProps(props as CollapsibleContentProps, [
    "class",
    "bodyClass",
    "children",
    "ref",
  ])
  const ctx = CollapsiblePrimitive.useCollapsibleContext()
  let el!: HTMLElement
  let body!: HTMLDivElement
  let runs: MotionControl[] = []
  const stop = () => {
    runs.forEach((r) => r.cancel())
    runs = []
  }

  onMount(() => {
    el.hidden = !ctx.isOpen()
    el.inert = !ctx.isOpen()
  })
  createEffect(
    on(
      ctx.isOpen,
      (open) => {
        // from where it is: folding back mid-way turns round there
        const from = el.hidden ? 0 : el.getBoundingClientRect().height
        stop()
        el.inert = !open
        el.hidden = false
        const to = open ? el.scrollHeight : 0
        const o = open
          ? MotionTokens.options.collapseEnter
          : MotionTokens.options.collapseExit
        const height = motion.animate(
          el,
          { height: [from, to] },
          { ...o, delay: MotionTokens.duration.collapseLead / 1000 },
        )
        const fade = motion.animate(
          body,
          { opacity: [open && from === 0 ? 0 : null, open ? 1 : 0] },
          { duration: o.duration, ease: MotionTokens.ease.standard },
        )
        const mine = [height, fade]
        runs = mine
        void Promise.all(mine.map((r) => r.finished)).then(() => {
          if (runs !== mine || height.state !== "finished") return
          // open, it follows its content again; folded, it leaves the layout
          el.style.removeProperty("height")
          el.hidden = !open
        })
      },
      { defer: true },
    ),
  )
  onCleanup(stop)

  return (
    <CollapsiblePrimitive.Content
      data-motion="collapsible"
      ref={withRef((e: HTMLElement) => (el = e), local.ref)}
      class={cn("overflow-hidden", local.class)}
      {...rest}
    >
      <div ref={body} class={local.bodyClass}>
        {local.children}
      </div>
    </CollapsiblePrimitive.Content>
  )
}
