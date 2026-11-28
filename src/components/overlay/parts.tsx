import * as DialogPrimitive from "@kobalte/core/dialog"
import { type Component, type JSX, splitProps } from "solid-js"
import { cn } from "~/utils/cn"

type DivProps = JSX.HTMLAttributes<HTMLDivElement>

// Kobalte's Title is an h2; the parts are divs, and Kobalte still gives the
// id that labels the dialog.
const Title = DialogPrimitive.Title as unknown as Component<
  DivProps & { as: "div" }
>

/** Header, body and footer of a dialog or a drawer; the sizes are hope's. */
export const PartHeader = (props: DivProps) => {
  const [local, rest] = splitProps(props, ["class"])
  return (
    <Title
      as="div"
      class={cn(
        "flex-[0] px-5 pt-5 pb-3 text-[1.125rem] font-medium",
        local.class,
      )}
      {...rest}
    />
  )
}

export const PartBody = (props: DivProps) => {
  const [local, rest] = splitProps(props, ["class"])
  return <div class={cn("flex-1 px-5 py-2", local.class)} {...rest} />
}

export const PartFooter = (props: DivProps) => {
  const [local, rest] = splitProps(props, ["class"])
  return (
    <div
      class={cn("flex items-center justify-end px-5 pt-3 pb-5", local.class)}
      {...rest}
    />
  )
}
