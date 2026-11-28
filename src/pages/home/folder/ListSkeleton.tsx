import { For } from "solid-js"
import { Skeleton } from "~/components/ui/skeleton"

const ListSkeleton = () => {
  return (
    <div class="flex flex-col items-center w-full gap-y-2">
      <For each={Array.from({ length: 10 })}>
        {() => <Skeleton class="rounded-lg w-full h-8" />}
      </For>
    </div>
  )
}

export default ListSkeleton
