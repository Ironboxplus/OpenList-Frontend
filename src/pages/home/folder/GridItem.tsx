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
import type { GridDecor } from "~/features/files/grid-decor"
import { CardBadge, CardTag, SelectCheck } from "~/features/files/GridBadges"
import { PosterArt } from "~/features/files/PosterArt"
import { selectionMode } from "~/features/files/selection-mode"
import { phoneShell, shellActive } from "~/features/shell/topbar-slot"
import { createLongPress } from "~/utils/touch"
import { ItemCheckbox, useSelectWithMouse } from "./helper"

export const GridItem = (props: {
  obj: StoreObj
  index: number
  /** Poster image URL; shown 2:3 and lazy, the icon takes over if it fails. */
  cover?: string
  /** Off for virtualized rows, which mount constantly while scrolling. */
  animate?: boolean
  /** Media view: replaces the name, size line and poster of this card. */
  decor?: () => GridDecor | undefined
}) => {
  const decor = () => props.decor?.()
  const cover = () => props.cover ?? decor()?.cover
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
          h={
            cover() || decor()?.placeholder || decor()?.mosaic?.length
              ? undefined
              : `${parseInt(local["grid_item_size"])}px`
          }
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
          <Show when={decor()?.badge}>
            <CardBadge text={decor()!.badge!} />
          </Show>
          <Show when={decor()?.tag}>
            <CardTag text={decor()!.tag!} />
          </Show>
          <Show when={selectionMode()}>
            <SelectCheck selected={props.obj.selected} />
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
          <PosterArt
            decor={decor()}
            cover={props.cover}
            seed={props.obj.name}
            alt={props.obj.name}
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
          />
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
          title={decor()?.label ?? props.obj.name}
        >
          {decor()?.label ?? props.obj.name}
        </Text>
        <Show
          when={decor()?.sub}
          fallback={
            <Show when={shellActive() && !props.obj.is_dir && props.obj.size}>
              <Text class="meta" fontSize="$xs" color="$neutral10">
                {getFileSize(props.obj.size)}
              </Text>
            </Show>
          }
        >
          <Text class="meta" fontSize="$xs" color="$neutral10">
            {decor()!.sub}
          </Text>
        </Show>
        <ExtraBadges extra={props.obj.extra} maxTags={1} />
      </VStack>
    </Motion.div>
  )
}
