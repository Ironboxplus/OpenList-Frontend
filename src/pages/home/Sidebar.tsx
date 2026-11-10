import { Box } from "@hope-ui/solid"
import { Motion } from "solid-motionone"
import { useLocation } from "@solidjs/router"
import {
  Show,
  createEffect,
  createMemo,
  createSignal,
  on,
  onCleanup,
  onMount,
} from "solid-js"
import { FolderTree, FolderTreeHandler } from "~/components"
import { useRouter } from "~/hooks"
import { local, objStore } from "~/store"
import { objBoxRef } from "./Obj"

function SidebarPanel() {
  const { to } = useRouter()
  const location = useLocation()

  const [folderTreeHandler, setFolderTreeHandler] =
    createSignal<FolderTreeHandler>()
  const [sideBarRef, setSideBarRef] = createSignal<HTMLDivElement>()
  const [anchorRef, setAnchorRef] = createSignal<HTMLDivElement>()
  const [offsetX, setOffsetX] = createSignal<number | string>(-999)

  const showFullSidebar = () => setOffsetX(0)
  const resetSidebar = () => {
    const $objBox = objBoxRef()
    const $sideBar = sideBarRef()
    if (!$objBox || !$sideBar) return
    // The free space the panel may rest in: from where it is anchored (the
    // content panel's left edge in the shell, the window's in the classic
    // layout) to the file box. Measured, not offsetLeft, which is relative to
    // the offset parent and knows nothing of the panel's anchor.
    const $anchor = anchorRef()
    if (!$anchor) return
    // The panel rests 3px inside its anchor (the shadow's room).
    const panelLeft = $anchor.getBoundingClientRect().left + 3
    const free = Math.max(0, $objBox.getBoundingClientRect().left - panelLeft)
    const gap = free > 50 ? 16 : 0
    if ($sideBar.clientWidth < free - gap) {
      setOffsetX(0)
    } else {
      setOffsetX(`calc(-100% + ${free}px - ${gap}px)`)
    }
  }

  let rafId: number

  // The room left of the file box changes with the layout around it (the
  // shell's nav folding, the first layout pass), not only with the window.
  createEffect(() => {
    const $objBox = objBoxRef()
    if (!$objBox || typeof ResizeObserver === "undefined") return
    const ro = new ResizeObserver(() => resetSidebar())
    ro.observe($objBox)
    onCleanup(() => ro.disconnect())
  })

  onMount(() => {
    const handler = folderTreeHandler()
    handler?.setPath(location.pathname)
    rafId = requestAnimationFrame(resetSidebar)
    window.addEventListener("resize", resetSidebar)
    onCleanup(() => window.removeEventListener("resize", resetSidebar))
  })

  createEffect(
    on(
      () => objStore.state,
      () => {
        cancelAnimationFrame(rafId)
        rafId = requestAnimationFrame(resetSidebar)
      },
    ),
  )

  createEffect(
    on(
      () => location.pathname,
      () => {
        const handler = folderTreeHandler()
        handler?.setPath(location.pathname)
      },
    ),
  )

  return (
    // The outer box is the anchor and the clip: fixed to the content panel in
    // the shell (the variables are unset elsewhere and fall back to 0, the
    // window's edge), it hides the part of the panel that is slid out of view,
    // so that part never covers the side nav. Its 3px padding leaves room for
    // the outline shadow. It lets pointer events through; the panel takes them.
    <Box
      pos="fixed"
      zIndex="$overlay"
      left="var(--shell-content-left, 0px)"
      top="var(--shell-top, 0px)"
      h="calc(100dvh - var(--shell-top, 0px) - var(--shell-gap, 0px))"
      p="3px"
      overflow="hidden"
      pointerEvents="none"
      ref={(el: HTMLDivElement) => setAnchorRef(el)}
    >
      <Box
        as={Motion.div}
        initial={{ x: -999 }}
        animate={{ x: offsetX() }}
        h="$full"
        minW={180}
        p="$2"
        overflow="auto"
        shadow="$lg"
        rounded="$lg"
        bgColor="white"
        pointerEvents="auto"
        _dark={{ bgColor: "$neutral3" }}
        onMouseEnter={showFullSidebar}
        onMouseLeave={resetSidebar}
        ref={(el: HTMLDivElement) => setSideBarRef(el)}
      >
        <FolderTree
          autoOpen
          showEmptyIcon
          showHiddenFolder={false}
          onChange={(path) => to(path)}
          handle={(handler) => setFolderTreeHandler(handler)}
        />
      </Box>
    </Box>
  )
}

export function Sidebar() {
  const visible = createMemo(() => local["show_sidebar"] !== "none")

  return (
    <Show when={visible()}>
      <SidebarPanel />
    </Show>
  )
}
