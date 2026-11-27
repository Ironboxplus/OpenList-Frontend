// Puts the viewers in the state the address names (state.ts), whatever changed
// it: a click, Back/Forward, a link or a refresh. A file address opens once its
// folder is listed (usePath lists the folder of a file it is handed); the
// folder's address closes what is open. The previews inside the document
// viewer and the small dialog read their file from objStore, as they did on
// the file page: while one is open, objStore.obj, raw_url and related hold
// that file, and the folder's come back when it closes.
import { useLocation, useNavigate } from "@solidjs/router"
import { createEffect, createMemo, on, onCleanup, untrack } from "solid-js"
import { addressPath, useRouter } from "~/hooks"
import {
  isListedFile,
  ObjStore,
  objStore,
  password,
  previewDenied,
  setFileShown,
  singleFileShare,
  State,
  viewerPath,
} from "~/store"
import type { Obj } from "~/types"
import { fsGet, notify } from "~/utils"
import { getPreviews } from "~/pages/home/previews"
import { DocViewer } from "./DocViewer"
import { ImageViewer } from "./ImageViewer"
import {
  apply,
  bindNav,
  current,
  dialogPath,
  dismissed,
  entryOf,
  overlay,
  setDismissed,
  setLoaded,
  whereOf,
  type Where,
} from "./state"
import { UnknownDialog } from "./UnknownDialog"

export const ViewerHost = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { searchParams, isShare } = useRouter()
  bindNav({
    navigate: (to, o) => navigate(to, o),
    search: () => location.search,
  })
  onCleanup(() => {
    bindNav(undefined)
    apply(undefined)
  })

  const address = createMemo(() => addressPath(location.pathname))
  createEffect(on(address, () => setDismissed(undefined), { defer: true }))
  let last: { path: string; where: Where; preview?: string } | undefined
  createEffect(() => {
    const raw = address()
    const named =
      raw === viewerPath() ||
      isListedFile(raw) ||
      (singleFileShare() && raw === objStore.listed)
    const target = named && dismissed() !== raw ? raw : undefined
    if (!target) {
      last = undefined
      if (untrack(current) || untrack(viewerPath))
        untrack(() => apply(undefined))
      return
    }
    if (
      objStore.state !== State.Folder &&
      objStore.state !== State.FetchingMore
    )
      return
    const obj = entryOf(target)
    if (!obj) return
    const preview = searchParams["preview"] || undefined
    previewDenied() // a share that turns out to refuse previews
    const previews = getPreviews({ ...obj, provider: objStore.provider })
    const where = whereOf(obj, previews, preview)
    untrack(() => {
      if (
        last?.path === target &&
        last.where === where &&
        last.preview === preview &&
        current() === target
      )
        return
      last = { path: target, where, preview }
      apply(target, where, preview)
    })
  })

  // The file of the document viewer or the small dialog, in objStore.
  let saved: { obj: Obj; raw_url: string; related: Obj[] } | undefined
  let seq = 0
  createEffect(
    on(
      () => (overlay()?.kind === "doc" ? overlay()!.path : dialogPath()),
      async (p) => {
        const my = ++seq
        setLoaded(undefined)
        if (!p) {
          if (saved) {
            ObjStore.set(saved)
            saved = undefined
            setFileShown(false)
          }
          return
        }
        if (!saved) {
          saved = JSON.parse(
            JSON.stringify({
              obj: objStore.obj,
              raw_url: objStore.raw_url,
              related: objStore.related,
            }),
          )
          setFileShown(true)
        }
        const row = entryOf(p)
        if (row) ObjStore.set({ obj: { ...row }, raw_url: "", related: [] })
        const resp = await fsGet(p, isShare() ? "" : password())
        if (my !== seq) return
        if (resp.code !== 200) {
          notify.error(resp.message)
          return
        }
        ObjStore.set({
          obj: resp.data,
          raw_url: resp.data.raw_url,
          related: resp.data.related ?? [],
        })
        setLoaded(p)
      },
    ),
  )

  return (
    <>
      <ImageViewer />
      <DocViewer />
      <UnknownDialog />
    </>
  )
}
