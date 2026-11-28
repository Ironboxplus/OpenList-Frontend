import { For, Show, createMemo } from "solid-js"
import { ImageItem } from "./ImageItem"
import { smartCountMsg, local, objStore } from "~/store"
import { GridItem } from "./GridItem"
import { ObjType, StoreObj } from "~/types"
import { useT } from "~/hooks"
import { useSelectWithMouse } from "./helper"

const ImageLayout = (props: { images: StoreObj[] }) => {
  const t = useT()
  const folders = createMemo(() => (
    <div class="image-folders grid w-full grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-1">
      <For each={objStore.objs.filter((obj) => obj.is_dir)}>
        {(obj, i) => {
          return <GridItem obj={obj} index={i()} />
        }}
      </For>
    </div>
  ))
  const { isMouseSupported, registerSelectContainer } = useSelectWithMouse()
  registerSelectContainer()
  return (
    <div class="flex flex-col items-center w-full gap-y-2 viselect-container">
      <Show when={local["show_count_msg"] === "visible"}>
        <div class="w-full text-left pl-2">
          <p class="text-muted-foreground text-sm leading-5">
            {smartCountMsg(ObjType.IMAGE)}
          </p>
        </div>
      </Show>
      <Show when={local["show_folder_in_image_view"] === "top"}>
        {folders()}
      </Show>
      <Show
        when={props.images.length > 0}
        fallback={<h2 class="font-semibold m-2">{t("home.no_images")}</h2>}
      >
        <div class="flex w-full gap-1 flex-wrap image-images">
          <For each={objStore.objs}>
            {(obj, i) => {
              return <ImageItem obj={obj} index={i()} />
            }}
          </For>
        </div>
      </Show>
      <Show when={local["show_folder_in_image_view"] === "bottom"}>
        {folders()}
      </Show>
    </div>
  )
}

export default ImageLayout
