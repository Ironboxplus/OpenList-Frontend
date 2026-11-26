import { Box, type HTMLHopeProps } from "@hope-ui/solid"
import * as DialogPrimitive from "@kobalte/core/dialog"
import {
  type Component,
  createContext,
  type JSX,
  type ParentProps,
  splitProps,
  useContext,
} from "solid-js"
import { DialogCloseButton } from "~/components/ui/dialog"
import { Sheet, SheetContent } from "~/components/ui/sheet"
import { cn } from "~/utils/cn"

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
  props: ParentProps<{ class?: string } & JSX.HTMLAttributes<HTMLDivElement>>,
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

const BoxTitle = DialogPrimitive.Title as unknown as Component<
  HTMLHopeProps<"div"> & { as: typeof Box }
>

export const DrawerHeader = (props: HTMLHopeProps<"div">) => (
  <BoxTitle
    as={Box}
    flex="0"
    pt="$5"
    px="$5"
    pb="$3"
    fontSize="$lg"
    fontWeight="$medium"
    {...props}
  />
)

export const DrawerBody = (props: HTMLHopeProps<"div">) => (
  <Box flex="1" px="$5" py="$2" overflowY="auto" {...props} />
)

export const DrawerFooter = (props: HTMLHopeProps<"div">) => (
  <Box
    display="flex"
    alignItems="center"
    justifyContent="flex-end"
    pt="$3"
    px="$5"
    pb="$5"
    {...props}
  />
)

export const DrawerCloseButton = (_props: Record<string, unknown>) => (
  <DialogCloseButton />
)
