import {
  Box,
  HStack,
  Icon,
  Progress,
  ProgressIndicator,
  ProgressLabel,
  Text,
} from "@hope-ui/solid"
import { Motion } from "solid-motionone"
import { useContextMenu } from "solid-contextmenu"
import { batch, createSignal, onCleanup, Show } from "solid-js"
import { LinkWithPush } from "~/components"
import { usePath, useRouter, useUtil } from "~/hooks"
import {
  checkboxOpen,
  getMainColor,
  getSettingBool,
  local,
  OrderBy,
  selectIndex,
} from "~/store"
import { MountDetails, ObjType, StoreObj } from "~/types"
import {
  bus,
  formatDate,
  getFileSize,
  hoverColor,
  isTouchDevice,
  showDiskUsage,
  usedPercentage,
  toReadableUsage,
  nearlyFull,
  listItemIn,
} from "~/utils"
import { getIconByObj } from "~/utils/icon"
import { ItemCheckbox, useSelectWithMouse } from "./helper"
import {
  isMediaPreviewEnabled,
  shouldShowPreview,
} from "~/plugins/builtin/media-preview/preview"

export interface Col {
  name: OrderBy
  textAlign: "left" | "right"
  w: any
}

export const cols: Col[] = [
  { name: "name", textAlign: "left", w: { "@initial": "76%", "@md": "50%" } },
  { name: "size", textAlign: "right", w: { "@initial": "24%", "@md": "17%" } },
  { name: "modified", textAlign: "right", w: { "@initial": 0, "@md": "33%" } },
]

const PREVIEW_DELAY_MS = 550

export const ListItem = (props: { obj: StoreObj; index: number }) => {
  const { isHide } = useUtil()
  if (isHide(props.obj)) {
    return null
  }
  const { setPathAs } = usePath()
  const { show } = useContextMenu({ id: 1 })
  const { pushHref, to } = useRouter()
  const { openWithDoubleClick, toggleWithClick, restoreSelectionCache } =
    useSelectWithMouse()
  const filenameStyle = () => local["list_item_filename_overflow"]

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
    setPathAs(props.obj.name, props.obj.is_dir, true)
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
    <Motion.div
      {...(listItemIn(props.index) as any)}
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
        cursor={
          openWithDoubleClick() || toggleWithClick() ? "default" : "pointer"
        }
        bgColor={props.obj.selected ? hoverColor() : undefined}
        on:dblclick={() => {
          if (!openWithDoubleClick()) return
          selectIndex(props.index, true, true)
          to(pushHref(props.obj.name))
        }}
        on:click={(e: MouseEvent) => {
          e.preventDefault()
          if (openWithDoubleClick()) return
          if (e.ctrlKey || e.metaKey || e.shiftKey) return
          if (!restoreSelectionCache()) return
          if (toggleWithClick())
            return selectIndex(props.index, !props.obj.selected)
          to(pushHref(props.obj.name))
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onContextMenu={(e: MouseEvent) => {
          batch(() => {
            // if (!checkboxOpen()) {
            //   toggleCheckbox();
            // }
            selectIndex(props.index, true, true)
          })
          show(e, { props: props.obj })
        }}
      >
        <HStack class="name-box" spacing="$1" w={cols[0].w}>
          <Show when={checkboxOpen()}>
            <ItemCheckbox
              // colorScheme="neutral"
              on:mousedown={(e: MouseEvent) => {
                e.stopPropagation()
              }}
              on:click={(e: MouseEvent) => {
                e.stopPropagation()
              }}
              checked={props.obj.selected}
              onChange={(e: any) => {
                selectIndex(props.index, e.target.checked)
              }}
            />
          </Show>
          <Icon
            class="icon"
            boxSize="$6"
            color={getMainColor()}
            as={getIconByObj(props.obj)}
            mr="$1"
            cursor={props.obj.type !== ObjType.IMAGE ? "inherit" : "pointer"}
            on:click={(e: MouseEvent) => {
              if (props.obj.type !== ObjType.IMAGE) return
              if (e.ctrlKey || e.metaKey || e.shiftKey) return
              if (!restoreSelectionCache()) return
              bus.emit("gallery", props.obj.name)
              e.preventDefault()
              e.stopPropagation()
            }}
          />
          <Text
            class="name"
            css={{
              wordBreak: "break-all",
              whiteSpace: filenameStyle() === "multi_line" ? "unset" : "nowrap",
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
        </HStack>
        <Show
          fallback={
            <Text
              class="size"
              w={cols[1].w}
              textAlign={cols[1].textAlign as any}
            >
              {getFileSize(props.obj.size)}
            </Text>
          }
          when={showDiskUsage(props.obj.mount_details)}
        >
          <Show
            fallback={
              <Text
                class="size"
                w={cols[1].w}
                textAlign={cols[1].textAlign as any}
              >
                {toReadableUsage(props.obj.mount_details!)}
              </Text>
            }
            when={!getSettingBool("show_disk_usage_in_plain_text")}
          >
            <Progress
              w={cols[1].w}
              class="disk-usage-percentage"
              trackColor="$info3"
              rounded="$full"
              size="md"
              value={usedPercentage(props.obj.mount_details!)}
            >
              <ProgressIndicator
                color={
                  nearlyFull(props.obj.mount_details!) ? "$danger6" : "$info6"
                }
                rounded="$md"
              />
              <ProgressLabel class="disk-usage-text">
                {toReadableUsage(props.obj.mount_details!)}
              </ProgressLabel>
            </Progress>
          </Show>
        </Show>
        <Text
          class="modified"
          display={{ "@initial": "none", "@md": "inline" }}
          w={cols[2].w}
          textAlign={cols[2].textAlign as any}
        >
          {formatDate(props.obj.modified)}
        </Text>
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
    </Motion.div>
  )
}
