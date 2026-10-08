import { Center, VStack, Icon, Text } from "@hope-ui/solid"
import { Motion } from "solid-motionone"
import { useContextMenu } from "solid-contextmenu"
import { batch, Show, untrack } from "solid-js"
import { CenterLoading, LinkWithPush, ImageWithError } from "~/components"
import { usePath, useRouter, useUtil } from "~/hooks"
import { checkboxOpen, getMainColor, local, selectIndex } from "~/store"
import { ObjType, StoreObj } from "~/types"
import { bus, getFileSize, hoverColor, listItemIn } from "~/utils"
import { getIconByObj } from "~/utils/icon"
import { ExtraBadges } from "./ExtraBadges"
import { TbCheck } from "solid-icons/tb"
import { selectionMode } from "~/features/files/selection-mode"
import { phoneShell, shellActive } from "~/features/shell/topbar-slot"
import { cn } from "~/utils/cn"
import { createLongPress } from "~/utils/touch"
import { GridCover } from "~/features/files/GridCover"
import { ItemCheckbox, useSelectWithMouse } from "./helper"

export const GridItem = (props: {
  obj: StoreObj
  index: number
  /** Poster image URL; shown 2:3 and lazy, the icon takes over if it fails. */
  cover?: string
  /** Off for virtualized rows, which mount constantly while scrolling. */
  animate?: boolean
}) => {
  const { isHide } = useUtil()
  if (isHide(props.obj)) {
    return null
  }
  const { setPathAs } = usePath()
  const filenameStyle = () => local["list_item_filename_overflow"]
  const objIcon = (
    <Icon
      color={getMainColor()}
      boxSize={`${parseInt(local["grid_item_size"]) - 30}px`}
      as={getIconByObj(props.obj)}
    />
  )
  const { show } = useContextMenu({ id: 1 })
  const { pushHref, to } = useRouter()
  const { openWithDoubleClick, toggleWithClick, restoreSelectionCache } =
    useSelectWithMouse()
  // Phone: long press selects, then taps toggle (same rule as the list rows).
  const press = createLongPress(() => {
    if (phoneShell() && !props.obj.selected) selectIndex(props.index, true)
  })
  return (
    <Motion.div
      {...(props.animate === false
        ? {}
        : (listItemIn(untrack(() => props.index)) as any))}
      style={{
        width: "100%",
      }}
    >
      <VStack
        classList={{ selected: !!props.obj.selected }}
        class="grid-item viselect-item"
        data-index={props.index}
        w="$full"
        p="$1"
        spacing="$1"
        rounded="$lg"
        transition="all 0.3s"
        _hover={{
          transform: "scale(1.06)",
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
        on:pointerdown={press.onPointerDown}
        on:pointermove={press.onPointerMove}
        on:pointerup={press.onPointerEnd}
        on:pointercancel={press.onPointerEnd}
        on:click={(e: MouseEvent) => {
          e.preventDefault()
          if (phoneShell()) {
            if (press.consumeClick()) return
            if (selectionMode())
              return selectIndex(props.index, !props.obj.selected)
          }
          if (openWithDoubleClick()) return
          if (e.ctrlKey || e.metaKey || e.shiftKey) return
          if (!restoreSelectionCache()) return
          if (toggleWithClick())
            return selectIndex(props.index, !props.obj.selected)
          to(pushHref(props.obj.name))
        }}
        onMouseEnter={() => {
          setPathAs(props.obj.name, props.obj.is_dir, true)
        }}
        onContextMenu={(e: MouseEvent) => {
          if (phoneShell()) return e.preventDefault()
          batch(() => {
            // if (!checkboxOpen()) {
            //   toggleCheckbox();
            // }
            selectIndex(props.index, true, true)
          })
          show(e, { props: props.obj })
        }}
      >
        <Center
          class="item-thumbnail"
          h={props.cover ? undefined : `${parseInt(local["grid_item_size"])}px`}
          w="$full"
          cursor={props.obj.type !== ObjType.IMAGE ? "inherit" : "pointer"}
          on:click={(e: MouseEvent) => {
            if (props.obj.type !== ObjType.IMAGE) return
            if (e.ctrlKey || e.metaKey || e.shiftKey) return
            if (!restoreSelectionCache()) return
            bus.emit("gallery", props.obj.name)
            e.preventDefault()
            e.stopPropagation()
          }}
          pos="relative"
        >
          <Show when={selectionMode()}>
            <span
              data-row-check
              class={cn(
                "absolute left-1 top-1 z-10 inline-flex size-6 items-center justify-center rounded-full border-2",
                props.obj.selected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-white/80 bg-black/20",
              )}
            >
              <Show when={props.obj.selected}>
                <TbCheck class="size-4" />
              </Show>
            </span>
          </Show>
          <Show when={checkboxOpen() && !phoneShell()}>
            <ItemCheckbox
              pos="absolute"
              left="$1"
              top="$1"
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
          <Show
            when={props.cover}
            fallback={
              <Show when={props.obj.thumb} fallback={objIcon}>
                <ImageWithError
                  maxH="$full"
                  maxW="$full"
                  rounded="$lg"
                  shadow="$md"
                  fallback={<CenterLoading size="lg" />}
                  fallbackErr={objIcon}
                  src={props.obj.thumb}
                  loading="lazy"
                />
              </Show>
            }
          >
            <GridCover
              src={props.cover}
              fallback={objIcon}
              alt={props.obj.name}
            />
          </Show>
        </Center>
        <Text
          class="name"
          css={{
            wordBreak: "break-all",
            whiteSpace: filenameStyle() === "multi_line" ? "unset" : "nowrap",
            "overflow-x": filenameStyle() === "scrollable" ? "auto" : "hidden",
            "overflow-y": "hidden",
            textOverflow: filenameStyle() === "ellipsis" ? "ellipsis" : "unset",
            "scrollbar-width": "none", // firefox
            "&::-webkit-scrollbar": {
              // webkit
              display: "none",
            },
          }}
          w="$full"
          textAlign="center"
          fontSize="$sm"
          title={props.obj.name}
        >
          {props.obj.name}
        </Text>
        <Show when={shellActive() && !props.obj.is_dir && props.obj.size}>
          <Text class="meta" fontSize="$xs" color="$neutral10">
            {getFileSize(props.obj.size)}
          </Text>
        </Show>
        <ExtraBadges extra={props.obj.extra} maxTags={1} />
      </VStack>
    </Motion.div>
  )
}
