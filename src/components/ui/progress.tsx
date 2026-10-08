// Copied from shadcn-solid (hngngn/shadcn-solid) tag shadcn-solid@0.7.0
// (commit 08b8ce27d80b289fe983051a14541ff53e08d9cb), registry/frameworks/tailwindcss/.
// The CLI is not used offline-first; imports were adapted to this repo's alias.
import { cn } from "~/utils/cn"
import type { PolymorphicProps } from "@kobalte/core/polymorphic"
import * as ProgressPrimitive from "@kobalte/core/progress"
import { type ParentProps, type ValidComponent, splitProps } from "solid-js"

export const ProgressLabel = ProgressPrimitive.Label
export const ProgressValueLabel = ProgressPrimitive.ValueLabel

type ProgressProps = ParentProps<
  ProgressPrimitive.ProgressRootProps & {
    class?: string
  }
>

export const Progress = <T extends ValidComponent = "div">(
  props: PolymorphicProps<T, ProgressProps>,
) => {
  const [local, rest] = splitProps(props as ProgressProps, [
    "class",
    "children",
  ])

  return (
    <ProgressPrimitive.Root
      class={cn("flex w-full flex-col gap-2", local.class)}
      {...rest}
    >
      {local.children}
      <ProgressPrimitive.Track class="h-2 overflow-hidden rounded-full bg-primary/20 data-[indeterminate]:bg-muted">
        <ProgressPrimitive.Fill
          class={
            "h-full w-(--kb-progress-fill-width) bg-primary transition-all duration-500 ease-linear data-[progress=complete]:bg-primary " +
            // Unknown progress: a block sliding across a gray track, so it can
            // never read as "almost done". Reduced motion gets a static,
            // semi-transparent full-width bar instead.
            "data-[indeterminate]:w-2/5 data-[indeterminate]:rounded-full data-[indeterminate]:transition-none data-[indeterminate]:animate-[indeterminate_1.4s_ease-in-out_infinite] motion-reduce:data-[indeterminate]:w-full motion-reduce:data-[indeterminate]:animate-none motion-reduce:data-[indeterminate]:opacity-30"
          }
        />
      </ProgressPrimitive.Track>
    </ProgressPrimitive.Root>
  )
}
