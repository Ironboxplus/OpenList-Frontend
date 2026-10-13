import { Box, HStack, Icon, Text, VStack } from "@hope-ui/solid"
import { createMemo, createSignal, Show } from "solid-js"
import { AiFillStar } from "solid-icons/ai"
import { LinkWithPush } from "~/components"
import { checkboxOpen, getMainColor, local } from "~/store"
import { StoreObj } from "~/types"
import { formatDate, formatDateCompact, getFileSize, hoverColor } from "~/utils"
import { getIconByObj } from "~/utils/icon"
import { readExtra } from "./extra-meta"
import { ItemCheckbox, useFileRowInteraction } from "./helper"
import { episodeFor } from "~/features/media/state"

/**
 * Two-line media row, used instead of {@link ListItem} inside storages whose
 * driver supplies media metadata (see `mediaPreset` in ./media-preset).
 *
 * Why a separate component rather than more columns on the table row: the table
 * layout allocates fixed percentage widths, so a short name wastes space while a
 * long release name (`落水狗.Reservoir.Dogs.1992.UHD.BluRay.2160p.x265…`) pushes
 * the metadata out of view entirely. Here the title owns a whole line and the
 * metadata owns its own, so neither can squeeze the other.
 *
 * Every field is optional and independently degraded — 115 does not populate
 * `play_long`/`def` for older uploads, and other drivers populate none of them.
 * A row with no extra metadata renders as title + size, never as empty slots.
 *
 * All values come from the `fs/list` payload that is already fetched for the
 * directory (`obj.thumb`, and `obj.extra` via `drivers/115_open/types.go`'s
 * `Extra()`), so rendering this costs no extra request and cannot trip the
 * provider's rate limit.
 */

/** 16:9 thumbnail box. Sized so the two text lines set the row height, not the image. */
const THUMB_W = 64
const THUMB_H = 36

export const MediaListItem = (props: {
  obj: StoreObj
  index: number
  /** Off for virtualized rows, which mount constantly while scrolling. */
}) => {
  // Selection / open / context-menu behaviour is shared with the table row —
  // see useFileRowInteraction. Only the visuals below are specific to this row.
  const ix = useFileRowInteraction(
    () => props.obj,
    () => props.index,
  )

  const meta = createMemo(() => readExtra(props.obj.extra))
  const [thumbFailed, setThumbFailed] = createSignal(false)
  const showThumb = () => !!props.obj.thumb && !thumbFailed()

  // Resolution labels come from 115's `def`/`def2` codes (see defLabel in
  // drivers/115_open/types.go). Only the top tiers earn an accent colour — if
  // everything is highlighted, nothing is.
  const resolutionAccent = () =>
    ["4K", "原画", "FHD"].includes(meta().resolution)

  /**
   * Secondary line. Built by filtering then joining so a missing field never
   * leaves a dangling separator (`4K ·  · 22.3G`).
   */
  const secondary = () =>
    [
      episodeFor(props.obj.name)?.text,
      meta().duration,
      props.obj.is_dir ? "" : getFileSize(props.obj.size),
      formatDateCompact(props.obj.modified),
    ]
      .filter((s) => s && s !== "-")
      .join("  ·  ")

  return (
    <div style={{ width: "100%" }}>
      <HStack
        classList={{ selected: !!props.obj.selected }}
        class="media-list-item viselect-item"
        data-index={props.index}
        w="$full"
        p="$2"
        spacing="$3"
        rounded="$lg"
        alignItems="center"
        // Only the background transitions. `transition: all` on every row of a
        // long list animates properties that never needed animating.
        css={{ transition: "background-color 0.15s ease" }}
        _hover={{ bgColor: hoverColor() }}
        as={LinkWithPush}
        href={props.obj.name}
        cursor={ix.cursor()}
        bgColor={props.obj.selected ? hoverColor() : undefined}
        on:dblclick={ix.onDblClick}
        on:click={ix.onClick}
        onMouseEnter={ix.onMouseEnter}
        onContextMenu={ix.onContextMenu}
        on:pointerdown={ix.onPointerDown}
        on:pointermove={ix.onPointerMove}
        on:pointerup={ix.onPointerEnd}
        on:pointercancel={ix.onPointerEnd}
      >
        <Show when={checkboxOpen()}>
          <ItemCheckbox
            on:mousedown={ix.stopPropagation}
            on:click={ix.stopPropagation}
            checked={props.obj.selected}
            onChange={ix.onCheckboxChange}
          />
        </Show>

        {/* Thumbnail, degrading to the type icon when absent or broken. A failed
            image must not leave a blank hole where the icon should be. */}
        <Box
          class="media-thumb"
          w={`${THUMB_W}px`}
          h={`${THUMB_H}px`}
          flexShrink={0}
          rounded="$md"
          overflow="hidden"
          bgColor="$neutral3"
          display="flex"
          alignItems="center"
          justifyContent="center"
        >
          <Show
            when={showThumb()}
            fallback={
              <Icon
                boxSize="$5"
                color={getMainColor()}
                as={getIconByObj(props.obj)}
              />
            }
          >
            <Box
              as="img"
              src={props.obj.thumb}
              loading="lazy"
              w="$full"
              h="$full"
              css={{ objectFit: "cover", display: "block" }}
              on:error={() => setThumbFailed(true)}
            />
          </Show>
        </Box>

        {/* min-w=0 is what lets the title truncate instead of forcing the row wider. */}
        <VStack
          flex={1}
          minW={0}
          alignItems="flex-start"
          spacing="$0_5"
          class="media-text"
        >
          <HStack w="$full" spacing="$2" alignItems="center">
            <Text
              class="name"
              fontSize="$sm"
              fontWeight="$medium"
              title={props.obj.name}
              css={{
                minWidth: 0,
                flex: 1,
                whiteSpace:
                  local["list_item_filename_overflow"] === "multi_line"
                    ? "unset"
                    : "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {props.obj.name}
            </Text>
            <Show when={meta().starred}>
              <Box as={AiFillStar} color="$warning8" title="starred" />
            </Show>
            <Show when={meta().resolution}>
              <Text
                class="resolution"
                flexShrink={0}
                fontSize="$xs"
                fontWeight="$medium"
                px="$1_5"
                rounded="$sm"
                color={resolutionAccent() ? "$accent11" : "$neutral11"}
                bgColor={resolutionAccent() ? "$accent3" : "$neutral4"}
              >
                {meta().resolution}
              </Text>
            </Show>
          </HStack>

          <HStack
            w="$full"
            spacing="$2"
            alignItems="center"
            color="$neutral10"
            fontSize="$xs"
          >
            <Text
              class="meta"
              css={{
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                fontVariantNumeric: "tabular-nums",
              }}
              title={
                props.obj.modified ? formatDate(props.obj.modified) : undefined
              }
            >
              {secondary()}
            </Text>
            <Show when={meta().tags.length}>
              <HStack spacing="$1" flexShrink={0}>
                {meta()
                  .tags.slice(0, 2)
                  .map((tag) => (
                    <Text
                      class="tag"
                      fontSize="$xs"
                      px="$1"
                      rounded="$sm"
                      bgColor="$neutral4"
                      css={{ whiteSpace: "nowrap" }}
                    >
                      {tag}
                    </Text>
                  ))}
              </HStack>
            </Show>
          </HStack>
        </VStack>
      </HStack>
    </div>
  )
}

export default MediaListItem
