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
import { useRouter } from "~/hooks"
import { loadSortState } from "./sort-state"
import { objStore, sortObjs, type OrderBy } from "~/store"
import { ObjType } from "~/types"
import { bus } from "~/utils"
import { openListed, rowOf } from "~/features/viewer/state"
import { Search } from "./Search"

const ListLayout = lazy(() => import("./List"))
const GridLayout = lazy(() => import("./Grid"))
const ImageLayout = lazy(() => import("./Images"))
const MasonryLayout = lazy(() => import("./Masonry"))
const PosterWall = lazy(() => import("./PosterWall"))

const Folder = () => {
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

  // A picture clicked in any layout opens the image viewer, out of its row
  // (it was lightGallery's: one image viewer now, features/viewer).
  bus.on("gallery", (name) => {
    const obj = objStore.objs.find((o) => o.name === name)
    if (obj) openListed(obj, rowOf(name))
  })
  onCleanup(() => bus.off("gallery"))
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
