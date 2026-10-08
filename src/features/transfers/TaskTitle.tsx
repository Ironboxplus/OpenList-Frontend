import { Show } from "solid-js"
import type { UnifiedTask } from "~/platform/contracts/task"
import { cn } from "~/utils/cn"
import { taskTitle } from "./adapter"
import { splitMiddle } from "./format"

/** `source → destination`, truncated in the middle so the tail stays readable. */
const Middle = (props: { text: string; class?: string }) => {
  const parts = () => splitMiddle(props.text)
  return (
    <span class={cn("flex min-w-0", props.class)} title={props.text}>
      <span class="truncate">{parts()[0]}</span>
      <Show when={parts()[1]}>
        <span class="shrink-0 whitespace-pre">{parts()[1]}</span>
      </Show>
    </span>
  )
}

export const TaskTitle = (props: { task: UnifiedTask; class?: string }) => {
  const title = () => taskTitle(props.task)
  return (
    <Show
      when={title().from && title().to}
      fallback={<Middle text={title().text} class={props.class} />}
    >
      <span
        class={cn("flex min-w-0 items-center gap-1", props.class)}
        title={title().text}
        data-testid="task-title"
      >
        <Middle text={title().from!} />
        <span class="shrink-0 text-muted-foreground">→</span>
        <Middle text={title().to!} />
      </span>
    </Show>
  )
}
