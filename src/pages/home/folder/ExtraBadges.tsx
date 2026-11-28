import { createMemo, For, Show } from "solid-js"
import { AiFillStar } from "solid-icons/ai"
import { ObjExtra } from "~/types"
import { hasExtra, readExtra } from "./extra-meta"
import { Tooltip } from "~/components/overlay"
import { Badge } from "~/components/ui/badge"

/**
 * Renders the optional driver-specific metadata bag (`obj.extra`) as compact
 * badges next to a file/folder. All parsing goes through the pure, unit-tested
 * `readExtra`, which never throws: a missing/null/wrong-typed value is skipped,
 * so a changed or unexpected backend payload degrades to "fewer badges" rather
 * than crashing the row.
 */
export const ExtraBadges = (props: {
  extra?: ObjExtra
  /** Max tags to show (the rest collapse into a "+N" badge listing all). Default 2. */
  maxTags?: number
}) => {
  const meta = createMemo(() => readExtra(props.extra))
  const tags = () => meta().tags.slice(0, props.maxTags ?? 2)
  const hidden = () => meta().tags.length - tags().length
  return (
    <Show when={hasExtra(meta())}>
      <div class="flex flex-row shrink-0 items-center gap-x-1">
        <Show when={meta().starred}>
          <AiFillStar class="text-warning" title="starred" />
        </Show>
        <Show when={meta().resolution}>
          <Badge variant="info" class="text-xs">
            {meta().resolution}
          </Badge>
        </Show>
        <Show when={meta().duration}>
          <p class="text-xs text-muted-foreground font-mono">
            {meta().duration}
          </p>
        </Show>
        <For each={tags()}>
          {(tag) => (
            <Badge variant="secondary" class="text-xs">
              {tag}
            </Badge>
          )}
        </For>
        <Show when={hidden() > 0}>
          <Tooltip label={meta().tags.join(", ")} withArrow>
            <Badge variant="secondary" class="text-xs">
              +{hidden()}
            </Badge>
          </Tooltip>
        </Show>
      </div>
    </Show>
  )
}

export default ExtraBadges
