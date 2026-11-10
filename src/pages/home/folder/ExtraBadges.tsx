import { Badge, Box, HStack, Text, Tooltip } from "@hope-ui/solid"
import { createMemo, For, Show } from "solid-js"
import { AiFillStar } from "solid-icons/ai"
import { ObjExtra } from "~/types"
import { hasExtra, readExtra } from "./extra-meta"

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
      <HStack spacing="$1" flexShrink={0} alignItems="center">
        <Show when={meta().starred}>
          <Box as={AiFillStar} color="$warning8" title="starred" />
        </Show>
        <Show when={meta().resolution}>
          <Badge colorScheme="info" variant="subtle" fontSize="$xs">
            {meta().resolution}
          </Badge>
        </Show>
        <Show when={meta().duration}>
          <Text fontSize="$xs" color="$neutral10" fontFamily="$mono">
            {meta().duration}
          </Text>
        </Show>
        <For each={tags()}>
          {(tag) => (
            <Badge colorScheme="neutral" variant="subtle" fontSize="$xs">
              {tag}
            </Badge>
          )}
        </For>
        <Show when={hidden() > 0}>
          <Tooltip label={meta().tags.join(", ")} withArrow>
            <Badge colorScheme="neutral" variant="subtle" fontSize="$xs">
              +{hidden()}
            </Badge>
          </Tooltip>
        </Show>
      </HStack>
    </Show>
  )
}

export default ExtraBadges
