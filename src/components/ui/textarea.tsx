// Copied from shadcn-solid (hngngn/shadcn-solid) tag shadcn-solid@0.7.0
// (commit 08b8ce27d80b289fe983051a14541ff53e08d9cb), registry/frameworks/tailwindcss/.
// The CLI is not used offline-first; imports were adapted to this repo's alias.
import { cn } from "~/utils/cn"
import type { PolymorphicProps } from "@kobalte/core/polymorphic"
import * as TextFieldPrimitive from "@kobalte/core/text-field"
import type { ValidComponent, VoidProps } from "solid-js"
import { splitProps } from "solid-js"

type TextAreaProps = VoidProps<
  TextFieldPrimitive.TextFieldTextAreaProps & {
    class?: string
  }
>

export const TextArea = <T extends ValidComponent = "textarea">(
  props: PolymorphicProps<T, TextAreaProps>,
) => {
  const [local, rest] = splitProps(props as TextAreaProps, ["class"])

  return (
    <TextFieldPrimitive.TextArea
      class={cn(
        "flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-shadow placeholder:text-muted-foreground outline-none! focus-visible:ring-[1.5px] focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        local.class,
      )}
      {...rest}
    />
  )
}
