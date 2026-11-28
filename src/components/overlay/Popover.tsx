import type { PopoverRootProps } from "@kobalte/core/popover"
import {
  createContext,
  createSignal,
  type JSX,
  splitProps,
  useContext,
} from "solid-js"
import {
  Popover as UiPopover,
  PopoverArrow as UiPopoverArrow,
  PopoverContent as UiPopoverContent,
  PopoverTrigger as UiPopoverTrigger,
} from "~/components/ui/popover"
import { cn } from "~/utils/cn"

type RenderProps = { opened: () => boolean; onClose: () => void }

export interface PopoverProps {
  /** Controlled when given. */
  opened?: boolean
  onOpen?: () => void
  onClose?: () => void
  /** hope's default: bottom, 8px off the trigger. */
  placement?: PopoverRootProps["placement"]
  offset?: number
  /** "none" drops the open/close animation. */
  motionPreset?: string
  /** Kobalte dismisses a popover on an outside interaction by default. */
  closeOnBlur?: boolean
  children?: JSX.Element | ((props: RenderProps) => JSX.Element)
}

const PopoverContext = createContext<{ animated: () => boolean }>({
  animated: () => true,
})

/** hope-ui's Popover API on the kit's Popover (Kobalte). */
export const Popover = (props: PopoverProps) => {
  const [own, setOwn] = createSignal(false)
  const opened = () => (props.opened !== undefined ? props.opened : own())
  const close = () => {
    setOwn(false)
    props.onClose?.()
  }
  const [local] = splitProps(props, ["children"])
  const body = () => {
    const c = local.children
    return typeof c === "function" && c.length > 0
      ? (c as (p: RenderProps) => JSX.Element)({ opened, onClose: close })
      : (c as JSX.Element)
  }
  return (
    <PopoverContext.Provider
      value={{ animated: () => props.motionPreset !== "none" }}
    >
      <UiPopover
        open={opened()}
        onOpenChange={(open) => {
          if (open) {
            setOwn(true)
            props.onOpen?.()
          } else close()
        }}
        placement={props.placement ?? "bottom"}
        gutter={props.offset ?? 8}
      >
        {body()}
      </UiPopover>
    </PopoverContext.Provider>
  )
}

export const PopoverTrigger = UiPopoverTrigger

/**
 * hope's look: column, at most 20rem wide. The callers' classes win over
 * these (cn merges them), so w-96 or max-w-[90vw] resize it.
 */
export const PopoverContent = (props: {
  class?: string
  children?: JSX.Element
}) => {
  const ctx = useContext(PopoverContext)
  return (
    <UiPopoverContent
      showClose={false}
      animated={ctx.animated()}
      class={cn("flex w-auto max-w-xs flex-col p-0", props.class)}
    >
      {props.children}
    </UiPopoverContent>
  )
}

export const PopoverArrow = (_props: Record<string, unknown>) => (
  <UiPopoverArrow />
)

export const PopoverHeader = (props: JSX.HTMLAttributes<HTMLDivElement>) => {
  const [local, rest] = splitProps(props, ["class"])
  return (
    <div
      class={cn(
        "flex flex-[0] items-center border-b border-border px-3 py-2 text-[1rem] font-medium",
        local.class,
      )}
      {...rest}
    />
  )
}

export const PopoverBody = (props: JSX.HTMLAttributes<HTMLDivElement>) => {
  const [local, rest] = splitProps(props, ["class"])
  return <div class={cn("flex-1 px-3 py-2", local.class)} {...rest} />
}
