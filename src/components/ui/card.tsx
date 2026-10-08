// Copied from shadcn-solid (hngngn/shadcn-solid) tag shadcn-solid@0.7.0
// (commit 08b8ce27d80b289fe983051a14541ff53e08d9cb), registry/frameworks/tailwindcss/.
// The CLI is not used offline-first; imports were adapted to this repo's alias.
import { cn } from "~/utils/cn"
import { type ComponentProps, type ParentComponent, splitProps } from "solid-js"

export const Card = (props: ComponentProps<"div">) => {
  const [local, rest] = splitProps(props, ["class"])
  return (
    <div
      class={cn(
        "rounded-xl border bg-card text-card-foreground shadow-sm",
        local.class,
      )}
      {...rest}
    />
  )
}

export const CardHeader = (props: ComponentProps<"div">) => {
  const [local, rest] = splitProps(props, ["class", "classList"])
  return (
    <div class={cn("flex flex-col space-y-1.5 p-6", local.class)} {...rest} />
  )
}

export const CardTitle: ParentComponent<ComponentProps<"h1">> = (props) => {
  const [local, rest] = splitProps(props, ["class", "classList"])
  return (
    <h1
      class={cn("font-semibold leading-none tracking-tight", local.class)}
      {...rest}
    />
  )
}

export const CardDescription: ParentComponent<ComponentProps<"h3">> = (
  props,
) => {
  const [local, rest] = splitProps(props, ["class", "classList"])
  return (
    <h3 class={cn("text-sm text-muted-foreground", local.class)} {...rest} />
  )
}

export const CardContent = (props: ComponentProps<"div">) => {
  const [local, rest] = splitProps(props, ["class", "classList"])
  return <div class={cn("p-6 pt-0", local.class)} {...rest} />
}

export const CardFooter = (props: ComponentProps<"div">) => {
  const [local, rest] = splitProps(props, ["class", "classList"])
  return <div class={cn("flex items-center p-6 pt-0", local.class)} {...rest} />
}
