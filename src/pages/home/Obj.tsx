import {
  createEffect,
  createMemo,
  createSignal,
  lazy,
  Match,
  on,
  Show,
  Suspense,
  Switch,
} from "solid-js"
import { Error, FullLoading, LinkWithBase } from "~/components"
import { useObjTitle, usePath, useRouter, useT } from "~/hooks"
import {
  getPagination,
  objStore,
  password,
  recordHistory,
  setPassword,
  layout,
  State,
  me,
} from "~/store"
import { UserMethods } from "~/types"
import {
  authShare,
  loginUrlFor,
  notify,
  setShareToken,
  shareIdOf,
} from "~/utils"
import { FilesArea } from "~/features/files/FilesArea"
import { FilesError, SlowLoadNotice } from "~/features/files/FilesState"
import { fadeThrough } from "~/features/files/files-motion"
import { shellActive } from "~/features/shell/topbar-slot"
import { Dock } from "~/features/viewer/Dock"
import { ViewerHost } from "~/features/viewer/ViewerHost"
import { Button } from "~/components/ui/button"
import { cn } from "~/utils/cn"

const Folder = lazy(() => import("./folder/Folder"))
const Password = lazy(() => import("./Password"))
const ListSkeleton = lazy(() => import("./folder/ListSkeleton"))
const GridSkeleton = lazy(() => import("./folder/GridSkeleton"))

const [objBoxRef, setObjBoxRef] = createSignal<HTMLDivElement>()
export { objBoxRef }

export const Obj = () => {
  const t = useT()
  const { pathname, searchParams, setSearchParams, isShare, to } = useRouter()
  // The share prompt keeps what is typed here only: a share password is traded
  // for a token and never stored (the folder prompt's cookie is not used).
  const [sharePwd, setSharePwd] = createSignal("")
  const tradeSharePassword = async (pwd: string) => {
    const id = shareIdOf(pathname())
    if (!id || !pwd) return false
    const resp = await authShare(id, pwd)
    if (resp.code === 200) {
      setShareToken(id, resp.data.token)
      return true
    }
    notify.error(resp.message)
    return false
  }
  const enterSharePassword = async () => {
    if (await tradeSharePassword(sharePwd())) {
      setSharePwd("")
      refresh(true)
    }
  }
  const { handlePathChange, refresh } = usePath()
  const pagination = getPagination()
  const page = createMemo(() => {
    return pagination.type === "pagination"
      ? parseInt(searchParams["page"], 10) || 1
      : undefined
  })
  let lastPathname: string
  let lastPage: number | undefined
  createEffect(
    on([pathname, page], async ([pathname, page]) => {
      // An old share link carries the password in its address.
      const oldPwd = searchParams["pwd"]
      if (oldPwd && !isShare()) setPassword(oldPwd)
      if (lastPathname) {
        recordHistory(lastPathname, lastPage)
        // another folder or page: what is there fades out before it changes
        fadeThrough("through")
      }
      lastPathname = pathname
      lastPage = page
      useObjTitle()
      if (oldPwd && isShare()) {
        // Trade it for a token before the first request, and take it out of
        // the address bar once the page is up.
        await tradeSharePassword(oldPwd)
        await handlePathChange(pathname, page)
        setSearchParams({ pwd: undefined }, { replace: true })
        return
      }
      await handlePathChange(pathname, page)
    }),
  )

  const isStorageError = createMemo(() => {
    const err = objStore.err
    return (
      err.includes("storage not found") || err.includes("please add a storage")
    )
  })

  const shouldShowStorageButton = createMemo(() => {
    return isStorageError() && UserMethods.is_admin(me())
  })

  const storageErrorActions = () => (
    <Button variant="subtle" onClick={() => to("/@manage/storages")}>
      {t("global.go_to_storages")}
    </Button>
  )
  return (
    <div
      ref={(el: HTMLDivElement) => setObjBoxRef(el)}
      class={cn(
        "obj-box flex w-full flex-col items-center gap-y-2 rounded-xl bg-white p-2 shadow-lg dark:bg-muted",
        shellActive() && "files-card",
      )}
    >
      {/* A file opens over its folder (features/viewer): the docked player
          above the list, the other viewers over the page. Both stay mounted
          across folders, so the player element is never made twice. */}
      <Dock />
      <ViewerHost />
      <FilesArea>
        <Suspense fallback={<FullLoading />}>
          <Switch>
            <Match when={objStore.err}>
              <Show
                when={shellActive()}
                fallback={
                  <Error
                    msg={objStore.err}
                    disableColor
                    actions={
                      shouldShowStorageButton()
                        ? storageErrorActions()
                        : undefined
                    }
                  />
                }
              >
                <FilesError
                  msg={objStore.err}
                  onRetry={() => refresh(undefined, true)}
                  actions={
                    shouldShowStorageButton()
                      ? storageErrorActions()
                      : undefined
                  }
                />
              </Show>
            </Match>
            <Match
              when={[State.FetchingObj, State.FetchingObjs].includes(
                objStore.state,
              )}
            >
              <SlowLoadNotice onRetry={() => refresh(undefined, true)} />
              <Show when={layout() === "list"} fallback={<GridSkeleton />}>
                <ListSkeleton />
              </Show>
            </Match>
            <Match when={objStore.state === State.NeedPassword}>
              <Password
                title={
                  isShare()
                    ? t("shares.input_password")
                    : t("home.input_password")
                }
                password={isShare() ? sharePwd : password}
                setPassword={isShare() ? setSharePwd : setPassword}
                enterCallback={() =>
                  isShare() ? enterSharePassword() : refresh(true)
                }
              >
                <Show when={!isShare()}>
                  <p>{t("global.have_account")}</p>
                  <LinkWithBase
                    class="text-primary"
                    href={loginUrlFor(location)}
                  >
                    {t("global.go_login")}
                  </LinkWithBase>
                </Show>
              </Password>
            </Match>
            <Match
              when={[State.Folder, State.FetchingMore].includes(objStore.state)}
            >
              <Folder />
            </Match>
          </Switch>
        </Suspense>
      </FilesArea>
    </div>
  )
}
