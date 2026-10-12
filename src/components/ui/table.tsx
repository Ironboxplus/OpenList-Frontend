// Copied from shadcn-solid (hngngn/shadcn-solid) tag shadcn-solid@0.7.0
// (commit 08b8ce27d80b289fe983051a14541ff53e08d9cb), registry/frameworks/tailwindcss/.
// The CLI is not used offline-first; imports were adapted to this repo's alias.
import { cn } from "~/utils/cn"
import { type ComponentProps, Show, splitProps } from "solid-js"

/**
 * `container={false}` drops the scrolling wrapper: a scroll container would
 * pin sticky headers to itself instead of to the page.
 */
export const Table = (
  props: ComponentProps<"table"> & { container?: boolean },
) => {
  const [local, rest] = splitProps(props, ["class", "container"])
  const table = () => (
    <table class={cn("w-full caption-bottom text-sm", local.class)} {...rest} />
  )
  return (
    <Show when={local.container !== false} fallback={table()}>
      <div class="relative w-full overflow-auto">{table()}</div>
    </Show>
  )
}

export const TableHeader = (props: ComponentProps<"thead">) => {
  const [local, rest] = splitProps(props, ["class"])
  return <thead class={cn("[&_tr]:border-b", local.class)} {...rest} />
}

export const TableBody = (props: ComponentProps<"tbody">) => {
  const [local, rest] = splitProps(props, ["class"])
  return (
    <tbody class={cn("[&_tr:last-child]:border-0", local.class)} {...rest} />
  )
}

export const TableRow = (props: ComponentProps<"tr">) => {
  const [local, rest] = splitProps(props, ["class"])
  return (
    <tr
      class={cn(
        "border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted",
        local.class,
      )}
      {...rest}
    />
  )
}

export const TableHead = (props: ComponentProps<"th">) => {
  const [local, rest] = splitProps(props, ["class"])
  return (
    <th
      class={cn(
        "h-10 px-3 text-left align-middle text-xs font-medium text-muted-foreground",
        local.class,
      )}
      {...rest}
    />
  )
}

export const TableCell = (props: ComponentProps<"td">) => {
  const [local, rest] = splitProps(props, ["class"])
  return <td class={cn("p-3 align-middle", local.class)} {...rest} />
}
