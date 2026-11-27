// Copied from shadcn-solid (hngngn/shadcn-solid) tag shadcn-solid@0.7.0
// (commit 08b8ce27d80b289fe983051a14541ff53e08d9cb), registry/frameworks/tailwindcss/.
// The CLI is not used offline-first; imports were adapted to this repo's alias.
import { cn } from "~/utils/cn"
import * as DialogPrimitive from "@kobalte/core/dialog"
import type { PolymorphicProps } from "@kobalte/core/polymorphic"
import type { VariantProps } from "class-variance-authority"
import { cva } from "class-variance-authority"
import { DialogCloseButton, DialogPresence } from "./dialog"
import { withRef } from "./overlay-presence"
import type { ComponentProps, ParentProps, ValidComponent } from "solid-js"
import { mergeProps, Show, splitProps } from "solid-js"
import { overlayMotion, scrimMotion } from "~/platform/motion"

/** A dialog that slides in from an edge; mounted through its exit like Dialog. */
export const Sheet = ((props: DialogPrimitive.DialogRootProps) => (
  <DialogPrimitive.Root forceMount {...props} />
)) as typeof DialogPrimitive.Root
export const SheetTrigger = DialogPrimitive.Trigger

type SheetOverlayProps = DialogPrimitive.DialogOverlayProps & {
  class?: string
  ref?: unknown
}

export const SheetOverlay = <T extends ValidComponent = "div">(
  props: PolymorphicProps<T, SheetOverlayProps>,
) => {
  const [local, rest] = splitProps(props as SheetOverlayProps, ["class"])

  return (
    <DialogPrimitive.Overlay
      data-motion="scrim"
      class={cn(
        "fixed inset-0 z-[1500] bg-background/80 backdrop-blur-sm",
        local.class,
      )}
      {...rest}
    />
  )
}

export const sheetVariants = cva(
  "fixed z-[1500] gap-4 bg-background p-6 shadow-lg",
  {
    variants: {
      side: {
        top: "inset-x-0 top-0 border-b",
        bottom: "inset-x-0 bottom-0 border-t",
        left: "inset-y-0 left-0 h-full w-3/4 border-r sm:max-w-sm",
        right: "inset-y-0 right-0 h-full w-3/4 border-l sm:max-w-sm",
      },
    },
    defaultVariants: {
      side: "right",
    },
  },
)

type SheetContentProps = ParentProps<
  DialogPrimitive.DialogContentProps &
    VariantProps<typeof sheetVariants> & {
      class?: string
      /** The X in the corner; on by default. */
      showClose?: boolean
      ref?: unknown
    }
>

export const SheetContent = <T extends ValidComponent = "div">(
  props: PolymorphicProps<T, SheetContentProps>,
) => {
  const merge = mergeProps({ side: "right" }, props)
  const [local, rest] = splitProps(merge, [
    "class",
    "children",
    "side",
    "showClose",
    "ref",
  ])
  const side = () => local.side ?? "right"

  return (
    <DialogPresence
      panel={overlayMotion("sheet", side())}
      scrim={scrimMotion("sheet")}
    >
      {(refs) => (
        <>
          <SheetOverlay ref={refs.scrim} />
          <DialogPrimitive.Content
            data-motion="sheet"
            ref={withRef(refs.panel, local.ref)}
            class={cn(sheetVariants({ side: local.side }), local.class)}
            {...rest}
          >
            {local.children}
            <Show when={local.showClose !== false}>
              <DialogCloseButton />
            </Show>
          </DialogPrimitive.Content>
        </>
      )}
    </DialogPresence>
  )
}

type SheetTitleProps = DialogPrimitive.DialogTitleProps & {
  class?: string
}

export const SheetTitle = <T extends ValidComponent = "h2">(
  props: PolymorphicProps<T, SheetTitleProps>,
) => {
  const [local, rest] = splitProps(props as SheetTitleProps, ["class"])

  return (
    <DialogPrimitive.Title
      class={cn("text-lg font-semibold text-foreground", local.class)}
      {...rest}
    />
  )
}

type SheetDescriptionProps = DialogPrimitive.DialogTitleProps & {
  class?: string
}

export const SheetDescription = <T extends ValidComponent = "p">(
  props: PolymorphicProps<T, SheetDescriptionProps>,
) => {
  const [local, rest] = splitProps(props as SheetDescriptionProps, ["class"])

  return (
    <DialogPrimitive.Description
      class={cn("text-sm text-muted-foreground", local.class)}
      {...rest}
    />
  )
}

export const SheetHeader = (props: ComponentProps<"div">) => {
  const [local, rest] = splitProps(props, ["class"])

  return (
    <div
      class={cn(
        "flex flex-col space-y-2 text-center sm:text-left",
        local.class,
      )}
      {...rest}
    />
  )
}

export const SheetFooter = (props: ComponentProps<"div">) => {
  const [local, rest] = splitProps(props, ["class"])

  return (
    <div
      class={cn(
        "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
        local.class,
      )}
      {...rest}
    />
  )
}
