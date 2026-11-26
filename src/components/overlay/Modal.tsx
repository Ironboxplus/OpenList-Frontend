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
import {
  Dialog,
  DialogCloseButton,
  DialogContent,
} from "~/components/ui/dialog"
import { cn } from "~/utils/cn"

/** hope's modal sizes (theme sizes xs 20rem … 2xl 42rem). */
export type ModalSize = "xs" | "sm" | "md" | "lg" | "xl" | "2xl"
/** hope's responsive object: "@initial" and its breakpoints (= Tailwind's). */
export type ResponsiveModalSize =
  | ModalSize
  | Partial<
      Record<"@initial" | "@sm" | "@md" | "@lg" | "@xl" | "@2xl", ModalSize>
    >

// Whole class names, so Tailwind sees them in this file.
const MAX_W: Record<string, Record<ModalSize, string>> = {
  "@initial": {
    xs: "max-w-[20rem]",
    sm: "max-w-[24rem]",
    md: "max-w-[28rem]",
    lg: "max-w-[32rem]",
    xl: "max-w-[36rem]",
    "2xl": "max-w-[42rem]",
  },
  "@sm": {
    xs: "sm:max-w-[20rem]",
    sm: "sm:max-w-[24rem]",
    md: "sm:max-w-[28rem]",
    lg: "sm:max-w-[32rem]",
    xl: "sm:max-w-[36rem]",
    "2xl": "sm:max-w-[42rem]",
  },
  "@md": {
    xs: "md:max-w-[20rem]",
    sm: "md:max-w-[24rem]",
    md: "md:max-w-[28rem]",
    lg: "md:max-w-[32rem]",
    xl: "md:max-w-[36rem]",
    "2xl": "md:max-w-[42rem]",
  },
  "@lg": {
    xs: "lg:max-w-[20rem]",
    sm: "lg:max-w-[24rem]",
    md: "lg:max-w-[28rem]",
    lg: "lg:max-w-[32rem]",
    xl: "lg:max-w-[36rem]",
    "2xl": "lg:max-w-[42rem]",
  },
  "@xl": {
    xs: "xl:max-w-[20rem]",
    sm: "xl:max-w-[24rem]",
    md: "xl:max-w-[28rem]",
    lg: "xl:max-w-[32rem]",
    xl: "xl:max-w-[36rem]",
    "2xl": "xl:max-w-[42rem]",
  },
  "@2xl": {
    xs: "2xl:max-w-[20rem]",
    sm: "2xl:max-w-[24rem]",
    md: "2xl:max-w-[28rem]",
    lg: "2xl:max-w-[32rem]",
    xl: "2xl:max-w-[36rem]",
    "2xl": "2xl:max-w-[42rem]",
  },
}
const BREAKPOINTS = ["@initial", "@sm", "@md", "@lg", "@xl", "@2xl"] as const

/** The max-width classes of a hope modal size (default md, as hope). */
export const modalSizeClass = (size: ResponsiveModalSize = "md") => {
  if (typeof size === "string") return MAX_W["@initial"][size]
  return BREAKPOINTS.filter((b) => size[b])
    .map((b) => MAX_W[b][size[b]!])
    .join(" ")
}

interface ModalOptions {
  size?: ResponsiveModalSize
  /** A selector, focused when the modal opens. */
  initialFocus?: string
  closeOnOverlayClick?: boolean
  closeOnEsc?: boolean
}
const ModalContext = createContext<ModalOptions>({})

export interface ModalProps extends ModalOptions {
  opened: boolean
  onClose: () => void
  /** Lock the page's scrolling while open (default true, as hope). */
  blockScrollOnMount?: boolean
  children?: JSX.Element
}

/**
 * hope-ui's Modal API on the kit's Dialog (Kobalte), so menus and dialogs
 * share Kobalte's layer stack and no second focus trap fights the first
 * (PLAN_FE_UNIFY_OVERLAYS_1126 §2.2 B).
 */
export const Modal = (props: ModalProps) => (
  <ModalContext.Provider value={props}>
    <Dialog
      open={props.opened}
      onOpenChange={(open) => {
        if (!open) props.onClose()
      }}
      preventScroll={props.blockScrollOnMount ?? true}
    >
      {props.children}
    </Dialog>
  </ModalContext.Provider>
)

/** The content draws its own overlay. */
export const ModalOverlay = (_props: Record<string, unknown>) => null

export const ModalContent = (
  props: ParentProps<{ class?: string } & JSX.HTMLAttributes<HTMLElement>>,
) => {
  const options = useContext(ModalContext)
  const [local, rest] = splitProps(props, ["class", "children"])
  let content: HTMLElement | undefined
  return (
    <DialogContent
      ref={(el: HTMLElement) => {
        content = el
      }}
      showClose={false}
      class={cn(
        "flex w-[calc(100%-2rem)] flex-col gap-0 p-0",
        modalSizeClass(options.size),
        local.class,
      )}
      onOpenAutoFocus={(e: Event) => {
        if (!options.initialFocus) return
        const target =
          content?.querySelector<HTMLElement>(options.initialFocus) ??
          document.querySelector<HTMLElement>(options.initialFocus)
        if (!target) return
        e.preventDefault()
        target.focus()
      }}
      onPointerDownOutside={(e: Event) => {
        if (options.closeOnOverlayClick === false) e.preventDefault()
      }}
      onEscapeKeyDown={(e: Event) => {
        if (options.closeOnEsc === false) e.preventDefault()
      }}
      {...rest}
    >
      {local.children}
    </DialogContent>
  )
}

// Kobalte's Title drawn by hope's Box: Kobalte gives the id that labels
// the dialog, Box takes the callers' style props (w, css).
const BoxTitle = DialogPrimitive.Title as unknown as Component<
  Omit<HTMLHopeProps<"div">, "as"> & { as: typeof Box }
>

/** The title, labelling the dialog; hope's look. */
export const ModalHeader = (props: Omit<HTMLHopeProps<"div">, "as">) => (
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

export const ModalBody = (props: HTMLHopeProps<"div">) => (
  <Box flex="1" px="$5" py="$2" {...props} />
)

export const ModalFooter = (props: HTMLHopeProps<"div">) => (
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

export const ModalCloseButton = (_props: Record<string, unknown>) => (
  <DialogCloseButton />
)
