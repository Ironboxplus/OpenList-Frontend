// Copied from shadcn-solid (hngngn/shadcn-solid) tag shadcn-solid@0.7.0
// (commit 08b8ce27d80b289fe983051a14541ff53e08d9cb), registry/frameworks/tailwindcss/.
// The CLI is not used offline-first; imports were adapted to this repo's alias.
// Added the success / warning / info variants the admin pages need.
import { cn } from "~/utils/cn"
import type { VariantProps } from "class-variance-authority"
import { cva } from "class-variance-authority"
import { type ComponentProps, splitProps } from "solid-js"

export const alertVariants = cva(
  "relative w-full rounded-lg border px-4 py-3 text-sm [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg+div]:translate-y-[-3px] [&:has(svg)]:pl-11",
  {
    variants: {
      variant: {
        default: "bg-background text-foreground",
        info: "border-primary/40 bg-primary/10 text-foreground",
        success: "border-success/40 bg-success/10 text-foreground",
        warning: "border-warning/50 bg-warning/10 text-foreground",
        destructive:
          "border-destructive/50 bg-destructive/10 text-destructive dark:border-destructive",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
)

export const Alert = (
  props: ComponentProps<"div"> & VariantProps<typeof alertVariants>,
) => {
  const [local, rest] = splitProps(props, ["class", "variant"])
  return (
    <div
      role="alert"
      class={cn(alertVariants({ variant: local.variant }), local.class)}
      {...rest}
    />
  )
}

export const AlertTitle = (props: ComponentProps<"h5">) => {
  const [local, rest] = splitProps(props, ["class"])
  return (
    <h5
      class={cn("mb-1 font-medium leading-none tracking-tight", local.class)}
      {...rest}
    />
  )
}

export const AlertDescription = (props: ComponentProps<"div">) => {
  const [local, rest] = splitProps(props, ["class"])
  return (
    <div class={cn("text-sm [&_p]:leading-relaxed", local.class)} {...rest} />
  )
}
