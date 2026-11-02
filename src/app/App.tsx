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
import type { InitStatus } from "~/types"
import type { UnifiedError } from "~/platform/contracts/task"
import {
  BackendUnavailable,
  Forbidden,
  initializedFrom,
  isStartupFailure,
  NotFound,
  Offline,
  startupStateFor,
  type StartupFailure,
} from "~/features/shell/states"
import { setArchiveExtensions } from "~/store/archive"
import { setMediaStatus, type MediaStatus } from "~/store/media"
import { base_path, bus, joinBase } from "~/utils"
import { onSettingsLoaded } from "./boot"
import { SECTION_LOADERS } from "~/features/shell/nav-items"
import { SessionGate } from "./MustUser"
import "./index.css"
import "./tailwind.css"
import { legacyTypeToFilter } from "~/features/transfers/adapter"
import { globalStyles } from "./theme"

const Home = lazy(SECTION_LOADERS.files)
const Manage = lazy(SECTION_LOADERS.settings)
const Login = lazy(() => import("~/pages/login"))
const Init = lazy(() => import("~/pages/init"))
const Test = lazy(() => import("~/pages/test"))
const AppShell = lazy(() => import("~/features/shell/AppShell"))
/** Persistent layout route: the shell stays mounted across page changes. */
const ShellLayout = () => (
  <SessionGate>
    <AppShell>
      <Outlet />
    </AppShell>
  </SessionGate>
)
const Transfers = lazy(SECTION_LOADERS.transfers)
const Dashboard = lazy(SECTION_LOADERS.dashboard)
const MediaSection = lazy(SECTION_LOADERS.media)
const MediaIndex = lazy(() =>
  import("~/pages/media/MediaSection").then((m) => ({
    default: m.MediaIndex,
  })),
)
const VideoLibrary = lazy(() => import("~/pages/media/video/VideoLibrary"))
const MusicLibrary = lazy(() => import("~/pages/media/music/MusicLibrary"))
const ImageLibrary = lazy(() => import("~/pages/media/image/ImageLibrary"))
const BookLibrary = lazy(() => import("~/pages/media/book/BookLibrary"))
// The first media backend's library, kept until its features are in the
// upstream pages (spec 1d, 2.2).
const LegacyLibrary = lazy(() => import("~/features/media/LibraryPage"))
const PluginsPage = lazy(SECTION_LOADERS.plugins)

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
    <Show when={!pathname().startsWith("/@")} fallback={<NotFound />}>
      <Home />
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
    state: StartupFailure
    error: UnifiedError
  }>()
  const [uninitialized, setUninitialized] = createSignal(false)
  // Startup needs /public/settings; without it the app cannot render at all.
  // The archive extension list only enables a few menu entries, so it may fail.
  // init_status tells an uninitialized backend (which refuses settings with a
  // 503) from a broken one; backends without the endpoint answer 404.
  const boot = async () => {
    if (retrying()) return
    setRetrying(true)
    const [settings, archive, init, media] = await Promise.all([
      api<Record<string, string>>("get", "/public/settings"),
      api<string[]>("get", "/public/archive_extensions"),
      api<InitStatus>("get", "/public/init_status"),
      api<MediaStatus>("get", "/public/media_status"),
    ])
    if (settings.ok) onSettingsLoaded(settings.data)
    const state = startupStateFor({
      settingsError: settings.ok ? undefined : settings.error,
      online: navigator.onLine,
      initialized: initializedFrom(init),
    })
    setUninitialized(state === "uninitialized")
    if (!settings.ok && isStartupFailure(state)) {
      setStartup({ state, error: settings.error })
    } else {
      setStartup(undefined)
    }
    // Backends without a media library answer 404: no libraries to list.
    setMediaStatus(media.ok ? media.data : undefined)
    if (archive.ok) setArchiveExtensions(archive.data)
    else console.warn("archive_extensions unavailable", archive.error)
    setRetrying(false)
    setBooting(false)
  }
  void boot()

  // An uninitialized backend has nothing to show but the setup wizard.
  createEffect(() => {
    if (uninitialized() && !pathname().startsWith("/@init")) to("/@init", true)
  })
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
            <Route path="/@init" component={Init} />
            <Route path="/@manage/tasks/:type?" component={TasksRedirect} />
            <Route
              path="/@manage/dashboard"
              element={<Navigate href={joinBase("/@dashboard")} />}
            />
            <Route path="/" component={ShellLayout}>
              <Route path="/@dashboard" element={<Dashboard />} />
              <Route path="/@media" component={MediaSection}>
                <Route path="/" component={MediaIndex} />
                <Route path="/video/*" component={VideoLibrary} />
                <Route path="/music/*" component={MusicLibrary} />
                <Route path="/image/*" component={ImageLibrary} />
                <Route path="/books/*" component={BookLibrary} />
                <Route path="/legacy" component={LegacyLibrary} />
              </Route>
              <Route path="/@plugins" element={<PluginsPage />} />
              <Route path="/@transfers" element={<Transfers />} />
              <Route path="/@manage/*" element={<Manage />} />
              <Route path={["/@s/*", "/%40s/*"]} element={<Home />} />
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
