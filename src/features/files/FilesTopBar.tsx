import { LibraryBadge, LibraryMenuItem } from "./LibraryMenuItem"
import {
  TbArrowLeft,
  TbChevronRight,
  TbDots,
  TbHome,
  TbLayoutGrid,
  TbLayoutList,
  TbMovie,
  TbPhoto,
  TbShare,
  TbColumns,
} from "solid-icons/tb"
import type { IconTypes } from "solid-icons"
import { createEffect, createMemo, createSignal, For, on, Show } from "solid-js"
import { Dynamic } from "solid-js/web"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { focusRing } from "~/components/ui/focus"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip"
import { usePath, useRouter, useT } from "~/hooks"
import { PluginSlot } from "~/plugins"
import { layout, LayoutType, me, objStore, setLayout, State } from "~/store"
import { UserMethods } from "~/types"
import { cn } from "~/utils/cn"
import { joinBase } from "~/utils/path"
import { fileCrumbs, parentCrumb, type FileCrumb } from "./crumbs"
import {
  chooseView,
  hasPosterView,
  mediaReady,
  openMediaEditor,
  posterActive,
} from "../media/state"
import { PhoneSelectionHeader } from "./PhoneActions"
import { selectionMode } from "./selection-mode"

const LAYOUTS: Record<LayoutType, IconTypes> = {
  list: TbLayoutList,
  grid: TbLayoutGrid,
  image: TbPhoto,
  masonry: TbColumns,
}

const plain = "no-underline hover:no-underline"
const iconButton = cn(
  focusRing,
  plain,
  "inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-transparent text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-40",
)

const useCrumbs = () => {
  const { pathname, isShare, to } = useRouter()
  const crumbs = createMemo(() => fileCrumbs(pathname(), isShare()))
  const go = (crumb: FileCrumb) => (e: MouseEvent) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return
    e.preventDefault()
    to(crumb.href)
  }
  return { crumbs, go }
}

/** `iconOnly`: the root shows just its icon (the caller names the control). */
const CrumbLabel = (props: { crumb: FileCrumb; iconOnly?: boolean }) => {
  const t = useT()
  return (
    <>
      <Show when={props.crumb.kind === "root"}>
        <TbHome class="size-4 shrink-0" />
        <Show when={!props.iconOnly}>
          <span>{t("shell.nav.files")}</span>
        </Show>
      </Show>
      <Show when={props.crumb.kind === "share"}>
        <TbShare class="size-4 shrink-0" />
        <span>{t("manage.sidemenu.shares")}</span>
      </Show>
      <Show when={props.crumb.kind === "dir"}>
        <span class="whitespace-nowrap">{props.crumb.label}</span>
      </Show>
    </>
  )
}

/** Tablet/desktop: scrollable breadcrumb that keeps the last segment in view. */
const DesktopCrumbs = () => {
  const { crumbs, go } = useCrumbs()
  const { setPathAs } = usePath()
  let box: HTMLElement | undefined
  createEffect(
    on(crumbs, () => {
      queueMicrotask(() => {
        if (box) box.scrollLeft = box.scrollWidth
      })
    }),
  )
  return (
    <nav
      ref={box}
      aria-label="breadcrumb"
      data-files-crumbs
      class="min-w-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <ol class="m-0 flex list-none items-center gap-0.5 p-0 text-sm">
        <For each={crumbs()}>
          {(crumb, i) => {
            const last = () => i() === crumbs().length - 1
            return (
              <>
                <Show when={i() > 0}>
                  <TbChevronRight class="size-3.5 shrink-0 text-muted-foreground" />
                </Show>
                <li class="shrink-0">
                  <Show
                    when={!last()}
                    fallback={
                      <span
                        aria-current="page"
                        class="flex items-center gap-1.5 px-1.5 py-1 font-medium text-foreground"
                      >
                        <CrumbLabel crumb={crumb} />
                      </span>
                    }
                  >
                    <a
                      href={joinBase(crumb.href)}
                      onClick={go(crumb)}
                      onMouseEnter={() => setPathAs(decodeURI(crumb.href))}
                      class={cn(
                        focusRing,
                        plain,
                        "flex items-center gap-1.5 rounded-md px-1.5 py-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                      )}
                    >
                      <CrumbLabel crumb={crumb} />
                    </a>
                  </Show>
                </li>
              </>
            )
          }}
        </For>
      </ol>
    </nav>
  )
}

/** Phone: back to the parent folder + current folder name (opens the full path). */
const PhoneCrumbs = () => {
  const t = useT()
  const { crumbs, go } = useCrumbs()
  const { to } = useRouter()
  const [open, setOpen] = createSignal(false)
  const parent = () => parentCrumb(crumbs())
  const current = () => crumbs()[crumbs().length - 1]
  return (
    <div class="flex min-w-0 items-center gap-1">
      <Show when={parent()}>
        {(p) => (
          <a
            href={joinBase(p().href)}
            aria-label={t("files.back_to_parent")}
            data-files-back
            onClick={(e) => go(p())(e)}
            class={iconButton}
          >
            <TbArrowLeft class="size-5" />
          </a>
        )}
      </Show>
      <button
        type="button"
        data-files-current
        aria-haspopup="dialog"
        // The bottom tab already says "Files"; on the root this button is the
        // home icon, and what it does is open the path list.
        aria-label={
          current().kind === "root" ? t("files.full_path") : undefined
        }
        onClick={() => setOpen(true)}
        class={cn(
          focusRing,
          "flex min-w-0 items-center gap-1.5 rounded-md bg-transparent px-1.5 py-1 text-sm font-medium text-foreground",
        )}
      >
        <span class="flex min-w-0 items-center gap-1.5 truncate">
          <CrumbLabel crumb={current()} iconOnly />
        </span>
      </button>
      <Sheet open={open()} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          class="max-h-[70vh] overflow-y-auto rounded-t-xl pb-8"
        >
          <SheetHeader>
            <SheetTitle>{t("files.full_path")}</SheetTitle>
          </SheetHeader>
          <ul class="m-0 mt-2 flex list-none flex-col p-0">
            <For each={crumbs()}>
              {(crumb, i) => (
                <li>
                  <button
                    type="button"
                    data-files-path-level
                    aria-current={
                      i() === crumbs().length - 1 ? "page" : undefined
                    }
                    onClick={() => {
                      setOpen(false)
                      to(crumb.href)
                    }}
                    style={{ "padding-left": `${0.75 + i() * 0.75}rem` }}
                    class={cn(
                      focusRing,
                      "flex h-11 w-full items-center gap-2 rounded-lg bg-transparent pr-3 text-left text-sm text-foreground hover:bg-accent",
                      i() === crumbs().length - 1 && "font-medium",
                    )}
                  >
                    <CrumbLabel crumb={crumb} />
                  </button>
                </li>
              )}
            </For>
          </ul>
        </SheetContent>
      </Sheet>
    </div>
  )
}

export const FilesTopLeft = (props: { phone: boolean }) => (
  <div class="flex min-w-0 items-center gap-2">
    <Show when={props.phone} fallback={<DesktopCrumbs />}>
      <Show when={!selectionMode()} fallback={<PhoneSelectionHeader />}>
        <PhoneCrumbs />
      </Show>
    </Show>
    <Show when={!selectionMode()}>
      <LibraryBadge />
    </Show>
  </div>
)

const pickLayout = (key: LayoutType) => {
  chooseView("other")
  setLayout(key)
}

const PosterMenuItem = () => {
  const t = useT()
  return (
    <Show when={hasPosterView()}>
      <DropdownMenuItem
        data-view-poster
        onSelect={() => chooseView("poster")}
        class={cn("gap-2", posterActive() && "font-medium")}
      >
        <TbMovie class="size-4" />
        {t("media.view_poster")}
      </DropdownMenuItem>
    </Show>
  )
}

/** Admin-only: open the media editor for this folder (phone "⋯" menu). */
const AdminMediaItem = () => {
  const t = useT()
  const { pathname } = useRouter()
  return (
    <Show when={UserMethods.is_admin(me()) && mediaReady()}>
      <DropdownMenuItem
        data-media-info
        onSelect={() => openMediaEditor(pathname())}
        class="gap-2"
      >
        <TbMovie class="size-4" />
        {t("media.menu_item")}
      </DropdownMenuItem>
    </Show>
  )
}

const layoutOn = () => objStore.state === State.Folder

/** Right side of the TopBar on the Files page: plugin widgets and the view. Searching is the command palette's (it offers "search this folder"). */
export const FilesTopRight = (props: { phone: boolean }) => {
  const t = useT()
  return (
    <>
      <PluginSlot name="header-right" />
      <Show
        when={!props.phone}
        fallback={
          <Show when={layoutOn() && !selectionMode()}>
            <DropdownMenu placement="bottom-end">
              <DropdownMenuTrigger
                aria-label={t("files.more")}
                data-files-more
                class={iconButton}
              >
                <TbDots class="size-5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <Show when={layoutOn()}>
                  <For each={Object.keys(LAYOUTS) as LayoutType[]}>
                    {(key) => (
                      <DropdownMenuItem
                        onSelect={() => pickLayout(key)}
                        class={cn(
                          "gap-2",
                          !posterActive() && layout() === key && "font-medium",
                        )}
                      >
                        <Dynamic component={LAYOUTS[key]} class="size-4" />
                        {t(`home.layouts.${key}`)}
                      </DropdownMenuItem>
                    )}
                  </For>
                  <PosterMenuItem />
                </Show>
                <AdminMediaItem />
                <LibraryMenuItem />
              </DropdownMenuContent>
            </DropdownMenu>
          </Show>
        }
      >
        <Show when={layoutOn()}>
          <DropdownMenu placement="bottom-end">
            <DropdownMenuTrigger
              aria-label={t("files.view")}
              data-files-view
              class={iconButton}
            >
              <Dynamic
                component={posterActive() ? TbMovie : LAYOUTS[layout()]}
                class="size-5"
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <For each={Object.keys(LAYOUTS) as LayoutType[]}>
                {(key) => (
                  <DropdownMenuItem
                    onSelect={() => pickLayout(key)}
                    class={cn(
                      "gap-2",
                      !posterActive() && layout() === key && "font-medium",
                    )}
                  >
                    <Dynamic component={LAYOUTS[key]} class="size-4" />
                    {t(`home.layouts.${key}`)}
                  </DropdownMenuItem>
                )}
              </For>
              <PosterMenuItem />
            </DropdownMenuContent>
          </DropdownMenu>
        </Show>
      </Show>
    </>
  )
}
