import { Show } from "solid-js"
import { Dynamic } from "solid-js/web"
import { CenterLoading, ImageWithError } from "~/components"
import { useLink, usePath, useUtil } from "~/hooks"
import { checkboxOpen, getMainColor, selectAll, selectIndex } from "~/store"
import { ObjType, StoreObj } from "~/types"
import { bus } from "~/utils"
import { getIconByObj } from "~/utils/icon"
import { selectForMenu, useSelectWithMouse } from "./helper"
import { ItemCheckbox } from "./ItemCheckbox"
import { cn } from "~/utils/cn"

export const ImageItem = (props: { obj: StoreObj; index: number }) => {
  const { isHide } = useUtil()
  if (isHide(props.obj) || props.obj.type !== ObjType.IMAGE) {
    return null
  }
  const { setPathAs } = usePath()
  const objIcon = (
    <Dynamic
      component={getIconByObj(props.obj)}
      class="size-12"
      style={{ color: getMainColor() }}
    />
  )
  const { previewLink } = useLink()
  const { openWithDoubleClick, toggleWithClick, restoreSelectionCache } =
    useSelectWithMouse()
  return (
    <div
      style={{
        "flex-grow": 1,
      }}
    >
      <div
        class={cn(
          "image-item viselect-item flex w-full flex-col items-center gap-y-1 rounded-lg border-2 border-transparent p-1 transition-all duration-300 hover:border-(--main)",
          props.obj.selected && "selected",
          openWithDoubleClick() || toggleWithClick()
            ? "cursor-default"
            : "cursor-pointer",
        )}
        style={{ "--main": getMainColor() }}
        data-index={props.index}
        data-row-name={props.obj.name}
        onMouseEnter={() => {
          setPathAs(props.obj.name, props.obj.is_dir, true)
        }}
        onContextMenu={() => selectForMenu(props.index)}
      >
        <div class="flex justify-center items-center w-full relative">
          <Show when={checkboxOpen()}>
            <ItemCheckbox
              stop
              class="absolute top-1 left-1"
              checked={props.obj.selected}
              onChange={(on) => {
                selectIndex(props.index, on)
              }}
            />
          </Show>
          <ImageWithError
            class="h-[150px] w-full rounded-lg object-cover shadow-md"
            fallback={<CenterLoading size="lg" />}
            fallbackErr={objIcon}
            src={previewLink(props.obj)}
            data-origin
            loading="lazy"
            on:dblclick={() => {
              if (!openWithDoubleClick()) return
              bus.emit("gallery", props.obj.name)
              selectIndex(props.index, true, true)
            }}
            on:click={(e: MouseEvent) => {
              if (openWithDoubleClick()) return
              if (e.ctrlKey || e.metaKey || e.shiftKey) return
              if (!restoreSelectionCache()) return
              if (toggleWithClick())
                return selectIndex(props.index, !props.obj.selected)
              bus.emit("gallery", props.obj.name)
            }}
          />
        </div>
      </div>
    </div>
  )
}
