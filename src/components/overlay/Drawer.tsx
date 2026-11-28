import {
  createContext,
  type JSX,
  type ParentProps,
  splitProps,
  useContext,
} from "solid-js"
import { DialogCloseButton } from "~/components/ui/dialog"
import { Sheet, SheetContent } from "~/components/ui/sheet"
import { cn } from "~/utils/cn"
import { PartBody, PartFooter, PartHeader } from "./parts"

type Placement = "top" | "right" | "bottom" | "left"
const DrawerContext = createContext<{ placement?: Placement }>({})

export interface DrawerProps {
  opened: boolean
  onClose: () => void
  placement?: Placement
  children?: JSX.Element
}

/** hope-ui's Drawer API on the kit's Sheet (Kobalte Dialog). */
export const Drawer = (props: DrawerProps) => (
  <DrawerContext.Provider value={props}>
    <Sheet
      open={props.opened}
      onOpenChange={(open) => {
        if (!open) props.onClose()
      }}
    >
      {props.children}
    </Sheet>
  </DrawerContext.Provider>
)

export const DrawerOverlay = (_props: Record<string, unknown>) => null

/** hope's default drawer is 20rem wide ("xs") and scrolls inside. */
export const DrawerContent = (
  props: ParentProps<{ class?: string } & JSX.HTMLAttributes<HTMLElement>>,
) => {
  const ctx = useContext(DrawerContext)
  const [local, rest] = splitProps(props, ["class", "children"])
  return (
    <SheetContent
      side={ctx.placement ?? "right"}
      showClose={false}
      class={cn(
        "flex max-h-dvh w-full max-w-[20rem] flex-col gap-0 p-0 sm:max-w-[20rem]",
        local.class,
      )}
      {...rest}
    >
      {local.children}
    </SheetContent>
  )
}

export const DrawerHeader = PartHeader

export const DrawerBody = (props: Parameters<typeof PartBody>[0]) => (
  <PartBody {...props} class={cn("overflow-y-auto", props.class)} />
)

export const DrawerFooter = PartFooter

export const DrawerCloseButton = (_props: Record<string, unknown>) => (
  <DialogCloseButton />
)
