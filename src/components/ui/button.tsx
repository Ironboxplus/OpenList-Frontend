// Copied from shadcn-solid (hngngn/shadcn-solid) tag shadcn-solid@0.7.0
// (commit 08b8ce27d80b289fe983051a14541ff53e08d9cb), registry/frameworks/tailwindcss/.
// The CLI is not used offline-first; imports were adapted to this repo's alias.
// Added for the pages that left hope-ui (P5, docs/FE_HOPE_TOKEN_MAP.md): the
// `subtle`, `success` and `warning` variants, the `xs` size and the icon sizes,
// and `loading` (a spinner before the label, the button disabled, as hope's).
import { cn } from "~/utils/cn"
import * as ButtonPrimitive from "@kobalte/core/button"
import type { PolymorphicProps } from "@kobalte/core/polymorphic"
import type { VariantProps } from "class-variance-authority"
import { cva } from "class-variance-authority"
import { TbLoader2 } from "solid-icons/tb"
import type { ValidComponent } from "solid-js"
import { Show, splitProps } from "solid-js"

export const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md bg-transparent text-sm text-foreground font-medium transition-[color,background-color,box-shadow] outline-none! focus-visible:ring-[1.5px] focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        // hope's default button (variant subtle, colour scheme info)
        subtle: "bg-primary/10 text-primary hover:bg-primary/20",
        success: "bg-success text-white hover:bg-success/90",
        warning: "bg-warning text-white hover:bg-warning/90",
      },
      size: {
        default: "h-9 px-4 py-2",
        xs: "h-6 rounded-md px-2 text-xs",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
        "icon-xs": "h-6 w-6",
        "icon-sm": "h-8 w-8",
        "icon-lg": "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

type ButtonProps = ButtonPrimitive.ButtonRootProps &
  VariantProps<typeof buttonVariants> & {
    class?: string
    /** A spinner before the label and the button disabled. */
    loading?: boolean
  }

export const Button = <T extends ValidComponent = "button">(
  props: PolymorphicProps<T, ButtonProps>,
) => {
  const [local, rest] = splitProps(props as ButtonProps, [
    "class",
    "variant",
    "size",
    "loading",
    "children",
    "disabled",
  ])

  return (
    <ButtonPrimitive.Root
      class={cn(
        buttonVariants({
          size: local.size,
          variant: local.variant,
        }),
        local.class,
      )}
      disabled={local.disabled || local.loading}
      {...rest}
    >
      <Show when={local.loading}>
        <TbLoader2 class="mr-2 size-4 animate-spin" aria-hidden="true" />
      </Show>
      {local.children}
    </ButtonPrimitive.Root>
  )
}
