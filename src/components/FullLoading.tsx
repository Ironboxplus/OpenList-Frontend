import { ComponentProps, JSXElement, Show } from "solid-js"
import { Spinner } from "~/components/ui/spinner"
import { cn } from "~/utils/cn"
import { getMainColor } from "~/store"

type Size = ComponentProps<typeof Spinner>["size"]

export const FullScreenLoading = () => {
  return (
    <div class="flex h-screen items-center justify-center">
      <Spinner
        size="xl"
        thickness="4px"
        speed="0.65s"
        color={getMainColor()}
        class="border-accent"
      />
    </div>
  )
}

export const FullLoading = (props: {
  /** Classes of the box (the padding is py-8 by default). */
  class?: string
  size?: Size
  thickness?: number
  ref?: any
}) => {
  return (
    <div
      ref={props.ref}
      class={cn(
        "flex h-full w-full items-center justify-center py-8",
        props.class,
      )}
    >
      <Spinner
        size={props.size ?? "xl"}
        thickness={`${props.thickness ?? 4}px`}
        speed="0.65s"
        color={getMainColor()}
        class="border-accent"
      />
    </div>
  )
}

export const MaybeLoading = (props: {
  children?: JSXElement
  loading?: boolean
}) => {
  return (
    <Show when={!props.loading} fallback={<FullLoading />}>
      {props.children}
    </Show>
  )
}

export const CenterLoading = (props: { size?: Size; class?: string }) => {
  return (
    <div
      class={cn("flex h-full w-full items-center justify-center", props.class)}
    >
      <Spinner color={getMainColor()} size={props.size} />
    </div>
  )
}
