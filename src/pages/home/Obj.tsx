import { Text, useColorModeValue, VStack, Button } from "@hope-ui/solid"
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
import { FilesError, SlowLoadNotice } from "~/features/files/FilesState"
import { shellActive } from "~/features/shell/topbar-slot"

const Folder = lazy(() => import("./folder/Folder"))
const File = lazy(() => import("./file/File"))
const Password = lazy(() => import("./Password"))
const ListSkeleton = lazy(() => import("./folder/ListSkeleton"))
const GridSkeleton = lazy(() => import("./folder/GridSkeleton"))

const [objBoxRef, setObjBoxRef] = createSignal<HTMLDivElement>()
export { objBoxRef }

export const Obj = () => {
  const t = useT()
  const cardBg = useColorModeValue("white", "$neutral3")
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
      if (searchParams["pwd"]) {
        if (isShare()) {
          // An old link carries the share password: trade it for a token and
          // take it out of the address bar.
          await tradeSharePassword(searchParams["pwd"])
          setSearchParams({ pwd: undefined }, { replace: true })
        } else {
          setPassword(searchParams["pwd"])
        }
      }
      if (lastPathname) {
        recordHistory(lastPathname, lastPage)
      }
      lastPathname = pathname
      lastPage = page
      useObjTitle()
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
    <Button colorScheme="accent" onClick={() => to("/@manage/storages")}>
      {t("global.go_to_storages")}
    </Button>
  )
  return (
    <VStack
      ref={(el: HTMLDivElement) => setObjBoxRef(el)}
      class="obj-box"
      classList={{ "files-card": shellActive() }}
      w="$full"
      rounded="$xl"
      bgColor={cardBg()}
      p="$2"
      shadow="$lg"
      spacing="$2"
    >
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
                  shouldShowStorageButton() ? storageErrorActions() : undefined
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
                <Text>{t("global.have_account")}</Text>
                <Text
                  color="$info9"
                  as={LinkWithBase}
                  href={loginUrlFor(location)}
                >
                  {t("global.go_login")}
                </Text>
              </Show>
            </Password>
          </Match>
          <Match
            when={[State.Folder, State.FetchingMore].includes(objStore.state)}
          >
            <Folder />
          </Match>
          <Match when={objStore.state === State.File}>
            <File />
          </Match>
        </Switch>
      </Suspense>
    </VStack>
  )
}
