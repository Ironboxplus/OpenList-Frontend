// Plain styled <input> / <textarea> in the look of ui/textfield.tsx, for forms
// that manage their own value (the Kobalte TextField re-syncs the DOM value on
// every keystroke, which fights a number field whose model is parsed).
import { cn } from "~/utils/cn"
import { type ComponentProps, splitProps } from "solid-js"

const fieldBase =
  "flex w-full rounded-md border border-input bg-transparent text-sm shadow-sm transition-shadow placeholder:text-muted-foreground outline-none! focus-visible:ring-[1.5px] focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 read-only:bg-muted/40 aria-[invalid=true]:border-destructive"

export const Input = (props: ComponentProps<"input">) => {
  const [local, rest] = splitProps(props, ["class"])
  return <input class={cn(fieldBase, "h-9 px-3 py-1", local.class)} {...rest} />
}

export const Textarea = (props: ComponentProps<"textarea">) => {
  const [local, rest] = splitProps(props, ["class"])
  return (
    <textarea
      class={cn(fieldBase, "min-h-[72px] px-3 py-2", local.class)}
      {...rest}
    />
  )
}
