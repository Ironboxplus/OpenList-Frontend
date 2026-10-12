import { Progress, ProgressIndicator } from "@hope-ui/solid"
import {
  Navigate,
  Outlet,
  Route,
  Routes,
  useIsRouting,
  useParams,
} from "@solidjs/router"
import {
  Component,
  createEffect,
  createSignal,
  lazy,
  Match,
  onCleanup,
  Show,
  Switch,
} from "solid-js"
import { Portal } from "solid-js/web"
import { FullScreenLoading } from "~/components"
import { useRouter } from "~/hooks"
import { api } from "~/platform/api/client"
import type { UnifiedError } from "~/platform/contracts/task"
import {
  BackendUnavailable,
  Forbidden,
  NotFound,
  Offline,
  startupStateFor,
  type StartupState,
} from "~/features/shell/states"
import { setSettings } from "~/store"
import { setArchiveExtensions } from "~/store/archive"
import { base_path, bus, joinBase } from "~/utils"
import { MustUser, UserOrGuest } from "./MustUser"
import "./index.css"
import "./tailwind.css"
import { legacyTypeToFilter } from "~/features/transfers/adapter"
import { globalStyles } from "./theme"

const Home = lazy(() => import("~/pages/home/Layout"))
const Manage = lazy(() => import("~/pages/manage"))
const Login = lazy(() => import("~/pages/login"))
const Init = lazy(() => import("~/pages/init"))
const Test = lazy(() => import("~/pages/test"))
const AppShell = lazy(() => import("~/features/shell/AppShell"))
/** Persistent layout route: the shell stays mounted across page changes. */
const ShellLayout = () => (
  <AppShell>
    <Outlet />
  </AppShell>
)
const Transfers = lazy(() => import("~/features/transfers/TransfersPage"))

/** Old `/@manage/tasks[/:type]` addresses now live on the Transfers page. */
const TasksRedirect = () => {
  const params = useParams()
  const key = legacyTypeToFilter(params.type)
  return (
    <Navigate
      href={joinBase("/@transfers") + (key === "all" ? "" : `?type=${key}`)}
    />
  )
}

/**
 * The `*` route is the file browser, so only addresses in the reserved `/@`
 * namespace can be unknown routes; everything else is a (maybe missing) path.
 */
const CatchAll = () => {
  const { pathname } = useRouter()
  return (
    <Show
      when={!pathname().startsWith("/@")}
      fallback={
        <MustUser>
          <NotFound />
        </MustUser>
      }
    >
      <MustUser>
        <Home />
      </MustUser>
    </Show>
  )
}

const App: Component = () => {
  globalStyles()
  const isRouting = useIsRouting()
  const { to, pathname } = useRouter()
  const onTo = (path: string) => {
    to(path)
  }
  bus.on("to", onTo)
  onCleanup(() => {
    bus.off("to", onTo)
  })

  createEffect(() => {
    bus.emit("pathname", pathname())
  })

  const [booting, setBooting] = createSignal(true)
  const [retrying, setRetrying] = createSignal(false)
  const [startup, setStartup] = createSignal<{
    state: StartupState
    error: UnifiedError
  }>()
  // Startup needs /public/settings; without it the app cannot render at all.
  // The archive extension list only enables a few menu entries, so it may fail.
  const boot = async () => {
    if (retrying()) return
    setRetrying(true)
    const [settings, archive] = await Promise.all([
      api<Record<string, string>>("get", "/public/settings"),
      api<string[]>("get", "/public/archive_extensions"),
    ])
    if (settings.ok) {
      setSettings(settings.data)
      setStartup(undefined)
    } else {
      setStartup({
        state: startupStateFor(settings.error, navigator.onLine),
        error: settings.error,
      })
    }
    if (archive.ok) setArchiveExtensions(archive.data)
    else console.warn("archive_extensions unavailable", archive.error)
    setRetrying(false)
    setBooting(false)
  }
  void boot()
  return (
    <>
      <Portal>
        <Progress
          indeterminate
          size="xs"
          position="fixed"
          top="0"
          left="0"
          right="0"
          zIndex="$banner"
          d={isRouting() ? "block" : "none"}
        >
          <ProgressIndicator />
        </Progress>
      </Portal>
      <Switch
        fallback={
          <Routes base={base_path}>
            <Route path="/@test" component={Test} />
            <Route path="/@login" component={Login} />
            <Route path="/@manage/tasks/:type?" component={TasksRedirect} />
            <Route path="/" component={ShellLayout}>
              <Route
                path="/@transfers"
                element={
                  <MustUser>
                    <Transfers />
                  </MustUser>
                }
              />
              <Route
                path="/@manage/*"
                element={
                  <MustUser>
                    <Manage />
                  </MustUser>
                }
              />
              <Route
                path={["/@s/*", "/%40s/*"]}
                element={
                  <UserOrGuest>
                    <Home />
                  </UserOrGuest>
                }
              />
              <Route path="*" component={CatchAll} />
            </Route>
          </Routes>
        }
      >
        <Match when={startup()}>
          {(failure) => (
            <Switch>
              <Match when={failure().state === "offline"}>
                <Offline fullscreen onRetry={boot} retrying={retrying()} />
              </Match>
              <Match when={failure().state === "forbidden"}>
                <Forbidden fullscreen />
              </Match>
              <Match when={failure().state === "backend"}>
                <BackendUnavailable
                  fullscreen
                  error={{
                    code: failure().error.code,
                    requestId: failure().error.requestId,
                  }}
                  onRetry={boot}
                  retrying={retrying()}
                />
              </Match>
            </Switch>
          )}
        </Match>
        <Match when={booting()}>
          <FullScreenLoading />
        </Match>
      </Switch>
    </>
  )
}

export default App
