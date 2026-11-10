import { Box, HStack, Icon, Text } from "@hope-ui/solid"
import { createSignal, onCleanup, Show } from "solid-js"
import { LinkWithPush } from "~/components"
import { useUtil } from "~/hooks"
import { checkboxOpen, getMainColor, local, OrderBy } from "~/store"
import { ObjType, StoreObj } from "~/types"
import { bus, hoverColor, isTouchDevice } from "~/utils"
import { getIconByObj } from "~/utils/icon"
import { ExtraBadges } from "./ExtraBadges"
import {
  EpisodeText,
  ModifiedText,
  SizeOrUsage,
} from "~/features/files/ItemMeta"
import { PhoneRowBody } from "~/features/files/PhoneRowBody"
import { RowThumb } from "~/features/files/RowThumb"
import { phoneShell } from "~/features/shell/topbar-slot"
import { ItemCheckbox, useFileRowInteraction } from "./helper"
import {
  isMediaPreviewEnabled,
  shouldShowPreview,
} from "~/plugins/builtin/media-preview/preview"

export interface Col {
  name: OrderBy
  textAlign: "left" | "right"
  w: any
}

// Shared with the `ListTitle` header in ./List.tsx, so header and rows stay
// aligned by construction rather than by copy.
//
// The `@md` split was 50/17/33: a third of every row was reserved for a
// 19-character timestamp. `formatDateCompact` caps `modified` at 11 characters,
// so that reserve is no longer needed and the freed width goes to `name`, which
// is what users actually scan. `size` keeps 17% because mount points render a
// disk-usage progress bar in that slot, not just a short byte count.
export const cols: Col[] = [
  { name: "name", textAlign: "left", w: { "@initial": "76%", "@md": "63%" } },
  { name: "size", textAlign: "right", w: { "@initial": "24%", "@md": "17%" } },
  { name: "modified", textAlign: "right", w: { "@initial": 0, "@md": "20%" } },
]

const PREVIEW_DELAY_MS = 550

export const ListItem = (props: {
  obj: StoreObj
  index: number
  /** Off for virtualized rows, which mount constantly while scrolling. */
}) => {
  const { isHide } = useUtil()
  if (isHide(props.obj)) {
    return null
  }
  // Shared with MediaListItem — see useFileRowInteraction.
  const ix = useFileRowInteraction(
    () => props.obj,
    () => props.index,
  )
  const filenameStyle = () => local["list_item_filename_overflow"]
  // Clicking an image's picture opens the gallery instead of the row's link.
  const openGallery = (e: MouseEvent) => {
    if (props.obj.type !== ObjType.IMAGE) return
    if (e.ctrlKey || e.metaKey || e.shiftKey) return
    if (!ix.restoreSelectionCache()) return
    bus.emit("gallery", props.obj.name)
    e.preventDefault()
    e.stopPropagation()
  }

  // Hover preview state — desktop/non-touch only
  const [previewVisible, setPreviewVisible] = createSignal(false)
  let hoverTimer: ReturnType<typeof setTimeout> | undefined

  const clearHoverTimer = () => {
    if (hoverTimer !== undefined) {
      clearTimeout(hoverTimer)
      hoverTimer = undefined
    }
  }

  const handleMouseEnter = () => {
    ix.onMouseEnter()
    if (
      shouldShowPreview({
        thumb: props.obj.thumb,
        isTouch: isTouchDevice(),
        enabled: isMediaPreviewEnabled(),
      })
    ) {
      clearHoverTimer()
      hoverTimer = setTimeout(() => setPreviewVisible(true), PREVIEW_DELAY_MS)
    }
  }

  const handleMouseLeave = () => {
    clearHoverTimer()
    setPreviewVisible(false)
  }

  onCleanup(() => {
    clearHoverTimer()
  })

  return (
    <div
      style={{
        width: "100%",
        position: "relative",
      }}
    >
      <HStack
        classList={{ selected: !!props.obj.selected }}
        class="list-item viselect-item"
        data-index={props.index}
        w="$full"
        p="$2"
        rounded="$lg"
        transition="all 0.3s"
        _hover={{
          transform: "scale(1.01)",
          bgColor: hoverColor(),
        }}
        as={LinkWithPush}
        href={props.obj.name}
        cursor={ix.cursor()}
        bgColor={props.obj.selected ? hoverColor() : undefined}
        on:dblclick={ix.onDblClick}
        on:click={ix.onClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onContextMenu={ix.onContextMenu}
        on:pointerdown={ix.onPointerDown}
        on:pointermove={ix.onPointerMove}
        on:pointerup={ix.onPointerEnd}
        on:pointercancel={ix.onPointerEnd}
      >
        <Show when={phoneShell()}>
          <PhoneRowBody obj={props.obj} />
        </Show>
        <Show when={!phoneShell()}>
          <HStack class="name-box" spacing="$1" w={cols[0].w}>
            <Show when={checkboxOpen()}>
              <ItemCheckbox
                on:mousedown={ix.stopPropagation}
                on:click={ix.stopPropagation}
                checked={props.obj.selected}
                onChange={ix.onCheckboxChange}
              />
            </Show>
            <RowThumb
              obj={props.obj}
              onClick={openGallery}
              fallback={
                <Icon
                  class="icon"
                  boxSize="$6"
                  color={getMainColor()}
                  as={getIconByObj(props.obj)}
                  mr="$1"
                  cursor={
                    props.obj.type !== ObjType.IMAGE ? "inherit" : "pointer"
                  }
                  on:click={openGallery}
                />
              }
            />
            <Text
              class="name"
              css={{
                wordBreak: "break-all",
                whiteSpace:
                  filenameStyle() === "multi_line" ? "unset" : "nowrap",
                "overflow-x":
                  filenameStyle() === "scrollable" ? "auto" : "hidden",
                textOverflow:
                  filenameStyle() === "ellipsis" ? "ellipsis" : "unset",
                "scrollbar-width": "none", // firefox
                "&::-webkit-scrollbar": {
                  // webkit
                  display: "none",
                },
              }}
              title={props.obj.name}
            >
              {props.obj.name}
            </Text>
            <EpisodeText name={props.obj.name} />
            <ExtraBadges extra={props.obj.extra} />
          </HStack>
          <Box w={cols[1].w} textAlign={cols[1].textAlign as any}>
            <SizeOrUsage obj={props.obj} />
          </Box>
          <Box
            display={{ "@initial": "none", "@md": "block" }}
            w={cols[2].w}
            textAlign={cols[2].textAlign as any}
          >
            <ModifiedText modified={props.obj.modified} />
          </Box>
        </Show>
      </HStack>

      {/* Hover thumbnail preview — desktop only, gated by plugin enabled state */}
      <Show when={previewVisible()}>
        <Box
          class="media-hover-preview"
          pos="absolute"
          // Position to the right of the name column, slightly above center
          top="50%"
          left="52%"
          zIndex={1000}
          pointerEvents="none"
          css={{
            transform: "translateY(-50%)",
            animation: "mediaPreviewFadeIn 0.18s ease-out forwards",
            "@keyframes mediaPreviewFadeIn": {
              from: { opacity: 0, transform: "translateY(-50%) scale(0.94)" },
              to: { opacity: 1, transform: "translateY(-50%) scale(1)" },
            },
          }}
        >
          <Box
            as="img"
            src={props.obj.thumb}
            maxW="320px"
            maxH="240px"
            rounded="$lg"
            shadow="$2xl"
            css={{
              display: "block",
              objectFit: "contain",
              border: "2px solid var(--hope-colors-neutral4)",
              background: "var(--hope-colors-neutral1)",
            }}
          />
        </Box>
      </Show>
    </div>
  )
}
