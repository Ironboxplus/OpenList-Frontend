import { For } from "solid-js"
import { Skeleton } from "~/components/ui/skeleton"

/** The card grid's placeholder while a folder loads: a row of chips, a row of cards. */
export const CardsSkeleton = () => (
  <div class="files-sections" aria-hidden="true">
    <div class="files-cards">
      <For each={Array.from({ length: 4 })}>
        {() => <Skeleton class="h-12 rounded-xl" />}
      </For>
    </div>
    <div class="files-cards">
      <For each={Array.from({ length: 4 })}>
        {() => <Skeleton class="aspect-[5/4] rounded-xl" />}
      </For>
    </div>
  </div>
)
