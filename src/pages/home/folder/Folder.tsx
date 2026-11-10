import {
  lazy,
  createEffect,
  createMemo,
  onCleanup,
  Switch,
  Match,
  on,
  Show,
} from "solid-js"
import { posterActive } from "~/features/media/state"
import { FileContextMenu } from "~/features/files/FileContextMenu"
import { FilesEmpty } from "~/features/files/FilesState"
import { PhoneFab } from "~/features/files/PhoneActions"
import { selectionMode } from "~/features/files/selection-mode"
import { phoneShell, shellActive } from "~/features/shell/topbar-slot"
import { layout } from "~/store"
import { Pager } from "./Pager"
import { useLink, useRouter, useT } from "~/hooks"
import { loadSortState } from "./sort-state"
import { objStore, local, sortObjs, type OrderBy } from "~/store"
import { ObjType } from "~/types"
import { bus } from "~/utils"
import lightGallery from "lightgallery"
import lgThumbnail from "lightgallery/plugins/thumbnail"
import lgZoom from "lightgallery/plugins/zoom"
import lgRotate from "lightgallery/plugins/rotate"
import lgAutoplay from "lightgallery/plugins/autoplay"
import lgFullscreen from "lightgallery/plugins/fullscreen"
import "lightgallery/css/lightgallery-bundle.css"
import { LightGallery } from "lightgallery/lightgallery"
import { Search } from "./Search"

const ListLayout = lazy(() => import("./List"))
const GridLayout = lazy(() => import("./Grid"))
const ImageLayout = lazy(() => import("./Images"))
const MasonryLayout = lazy(() => import("./Masonry"))
const PosterWall = lazy(() => import("./PosterWall"))

const Folder = () => {
  const { previewLink } = useLink()
  const { pathname } = useRouter()
  // Only the list's header used to apply the remembered sort; every view shares
  // the toolbar's sort menu now, so the folder applies it for all of them each
  // time a listing (or another page of it) arrives.
  createEffect(
    on(
      () => objStore.objs.length,
      (n) => {
        const saved = n > 0 ? loadSortState(pathname()) : null
        if (saved) sortObjs(saved.orderBy as OrderBy, saved.reverse)
      },
    ),
  )
  const images = createMemo(() =>
    objStore.objs.filter((obj) => obj.type === ObjType.IMAGE),
  )

  let dynamicGallery: LightGallery | undefined
  const initGallery = () => {
    dynamicGallery = lightGallery(document.createElement("div"), {
      addClass: "lightgallery-container",
      dynamic: true,
      thumbnail: local["show_gallery_thumbnails"] === "visible",
      plugins: [lgZoom, lgThumbnail, lgRotate, lgAutoplay, lgFullscreen],
      dynamicEl: images().map((obj) => {
        const raw = previewLink(obj, true)
        return {
          src: raw,
          thumb: obj.thumb === "" ? raw : obj.thumb,
          subHtml: `<h4>${obj.name}</h4>`,
        }
      }),
    })
  }
  createEffect(
    on([images, () => local["show_gallery_thumbnails"]], () => {
      dynamicGallery?.destroy()
      dynamicGallery = undefined
    }),
  )
  bus.on("gallery", (name) => {
    if (!dynamicGallery) {
      initGallery()
    }
    dynamicGallery?.openGallery(images().findIndex((obj) => obj.name === name))
  })
  onCleanup(() => {
    bus.off("gallery")
    dynamicGallery?.destroy()
  })
  const t = useT()
  return (
    <>
      <Show when={shellActive() && phoneShell() && !selectionMode()}>
        <PhoneFab />
      </Show>
      <FileContextMenu>
        <Show
          when={objStore.objs.length > 0 || !shellActive()}
          fallback={<FilesEmpty />}
        >
          <Switch>
            <Match when={posterActive()}>
              <PosterWall />
            </Match>
            <Match when={layout() === "list"}>
              <ListLayout />
            </Match>
            <Match when={layout() === "grid"}>
              <GridLayout />
            </Match>
            <Match when={layout() === "image"}>
              <ImageLayout images={images()} />
            </Match>
            <Match when={layout() === "masonry"}>
              <MasonryLayout images={images()} />
            </Match>
          </Switch>
        </Show>
      </FileContextMenu>
      <Pager />
      <Search />
    </>
  )
}

export default Folder
