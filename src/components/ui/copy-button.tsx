// A button that copies (plan §P4, research 02 §三): its icon turns into a
// check (100ms) and stays one for 1.5s, which says "copied" where the eye
// already is; no toast. A copy that fails still says why in a toast (useUtil).
import { TbCheck, TbCopy } from "solid-icons/tb"
import type { IconTypes } from "solid-icons"
import type { VariantProps } from "class-variance-authority"
import { createSignal, onCleanup, Show, splitProps, type JSX } from "solid-js"
import { Dynamic } from "solid-js/web"
import { useT, useUtil } from "~/hooks"
import { MotionTokens, playOnce } from "~/platform/motion"
import { cn } from "~/utils/cn"
import { Button, buttonVariants } from "./button"

/** How long the check stays. */
export const COPIED_MS = 1500

type CopyButtonProps = VariantProps<typeof buttonVariants> & {
  /** What is copied, read on the click. */
  text: () => string
  /** The icon before the copy (a link, say); a copy icon if not given. */
  icon?: IconTypes
  class?: string
  disabled?: boolean
  "aria-label"?: string
  children?: JSX.Element
}

export const CopyButton = (props: CopyButtonProps) => {
  const t = useT()
  const { copy } = useUtil()
  const [local, rest] = splitProps(props, ["text", "icon", "children", "class"])
  const [copied, setCopied] = createSignal(false)
  let swapped = false
  let timer: ReturnType<typeof setTimeout> | undefined
  onCleanup(() => clearTimeout(timer))
  // the icon that comes in after a swap turns up from small; not the first one
  const swapIn = (el: HTMLElement) => {
    if (!swapped) return
    playOnce(
      el,
      { opacity: [0, 1], transform: ["scale(0.6)", "scale(1)"] },
      MotionTokens.options.iconSwap,
    )
  }
  return (
    <Button
      type="button"
      data-testid="copy-button"
      data-copied={copied() ? "" : undefined}
      class={cn("gap-2", local.class)}
      {...rest}
      onClick={async () => {
        if (!(await copy(local.text(), { quiet: true }))) return
        swapped = true
        setCopied(true)
        clearTimeout(timer)
        timer = setTimeout(() => setCopied(false), COPIED_MS)
      }}
    >
      <Show
        when={copied()}
        fallback={
          <span data-motion="copy-icon" class="inline-flex" ref={swapIn}>
            <Dynamic
              component={local.icon ?? TbCopy}
              class="size-4"
              aria-hidden="true"
            />
          </span>
        }
      >
        <span
          data-motion="copy-icon"
          class="inline-flex text-success"
          ref={swapIn}
        >
          <TbCheck class="size-4" aria-hidden="true" />
        </span>
      </Show>
      {local.children}
      <span class="sr-only" aria-live="polite">
        {copied() ? t("global.copied") : ""}
      </span>
    </Button>
  )
}
