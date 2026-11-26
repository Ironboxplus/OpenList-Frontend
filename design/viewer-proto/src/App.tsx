// The Files page of the prototype: a top bar, the content card with the docked
// player above the list, and the viewers that open over it. The shell is cut
// down to what the viewers touch (no side nav, no toolbars).
import { For, Show, createEffect, createSignal, onMount } from "solid-js"
import { useColorMode } from "@hope-ui/solid"
import { TbChevronRight, TbLogout, TbMoon, TbSun } from "solid-icons/tb"
import { DocViewer } from "./DocViewer"
import { Dock } from "./Dock"
import { FileList } from "./FileList"
import { ImageViewer } from "./ImageViewer"
import { Login } from "./Login"
import { ShareDialog } from "./ShareDialog"
import { UnknownDialog } from "./UnknownDialog"
import { reducedMotion } from "./motion"
import { boot, dir, goDir, loadError, needLogin, signOut } from "./state"
import { IconButton, isPhone } from "./ui"

const TopBar = () => {
  const { colorMode, toggleColorMode } = useColorMode()
  const [reduced, setReduced] = createSignal(reducedMotion())
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
  mq.addEventListener("change", () => setReduced(mq.matches))
  const crumbs = () => {
    const p = dir()?.path ?? "/"
    const parts = p.split("/").filter(Boolean)
    return parts.map((name, i) => ({
      name,
      path: "/" + parts.slice(0, i + 1).join("/"),
    }))
  }
  return (
    <header class="fixed inset-x-0 top-0 z-20 flex h-(--proto-bar) items-center gap-2 bg-(--canvas) px-3 sm:px-4">
      <span class="shrink-0 text-base font-semibold text-primary">
        OpenList
      </span>
      <nav
        aria-label="位置"
        class="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto text-sm"
      >
        <For each={crumbs()}>
          {(c, i) => (
            <>
              <Show when={i() > 0 || !isPhone()}>
                <TbChevronRight class="size-4 shrink-0 text-muted-foreground" />
              </Show>
              <button
                type="button"
                class="shrink-0 truncate rounded border-0 bg-transparent px-1.5 py-1 hover:bg-accent"
                aria-current={i() === crumbs().length - 1 ? "page" : undefined}
                onClick={() => goDir(c.path)}
              >
                {c.name}
              </button>
            </>
          )}
        </For>
      </nav>
      <Show when={reduced()}>
        <span
          data-testid="reduced-badge"
          class="shrink-0 rounded-full border px-2 py-0.5 text-xs text-muted-foreground"
        >
          减少动态效果
        </span>
      </Show>
      <IconButton
        label={colorMode() === "dark" ? "浅色" : "深色"}
        onClick={() => toggleColorMode()}
      >
        {colorMode() === "dark" ? <TbSun /> : <TbMoon />}
      </IconButton>
      <Show when={!needLogin()}>
        <IconButton
          label="退出登录"
          testid="logout"
          onClick={() => void signOut()}
        >
          <TbLogout />
        </IconButton>
      </Show>
    </header>
  )
}

export const App = () => {
  createEffect(() =>
    document.documentElement.style.setProperty(
      "--proto-bar",
      isPhone() ? "56px" : "64px",
    ),
  )
  onMount(() => void boot())
  return (
    <>
      <TopBar />
      {/* #root is a centred flex column (src/app/theme.ts globalStyles) */}
      <main class="w-full px-0 pb-24 pt-(--proto-bar) sm:px-3">
        <Show when={needLogin()}>
          <Login />
        </Show>
        {/* kept mounted while signed out: the one player of the page stays */}
        <div
          classList={{ hidden: needLogin() }}
          class="mx-auto max-w-[1400px] overflow-clip sm:mt-3 sm:rounded-xl"
          style={{
            background: "var(--files-card-bg)",
            "box-shadow": "var(--files-card-shadow)",
          }}
        >
          <Dock />
          <Show when={loadError()}>
            <div class="p-6 text-sm text-destructive">{loadError()}</div>
          </Show>
          <FileList />
        </div>
      </main>
      <ImageViewer />
      <DocViewer />
      <UnknownDialog />
      <ShareDialog />
    </>
  )
}
