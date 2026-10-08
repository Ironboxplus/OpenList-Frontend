import {
  TbArrowLeft,
  TbChevronRight,
  TbDots,
  TbFileSearch,
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
import {
  getSetting,
  layout,
  LayoutType,
  objStore,
  setLayout,
  State,
} from "~/store"
import { bus } from "~/utils/bus"
import { cn } from "~/utils/cn"
import { joinBase } from "~/utils/path"
import { fileCrumbs, parentCrumb, type FileCrumb } from "./crumbs"
import { chooseView, hasPosterView, posterActive } from "../media/state"
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

const CrumbLabel = (props: { crumb: FileCrumb }) => {
  const t = useT()
  return (
    <>
      <Show when={props.crumb.kind === "root"}>
        <TbHome class="size-4 shrink-0" />
        <span>{t("manage.sidemenu.home")}</span>
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
        onClick={() => setOpen(true)}
        class={cn(
          focusRing,
          "flex min-w-0 items-center gap-1.5 rounded-md bg-transparent px-1.5 py-1 text-sm font-medium text-foreground",
        )}
      >
        <span class="flex min-w-0 items-center gap-1.5 truncate">
          <CrumbLabel crumb={current()} />
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
  <Show when={props.phone} fallback={<DesktopCrumbs />}>
    <Show when={!selectionMode()} fallback={<PhoneSelectionHeader />}>
      <PhoneCrumbs />
    </Show>
  </Show>
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

const searchOn = () =>
  objStore.state === State.Folder && getSetting("search_index") !== "none"
const layoutOn = () => objStore.state === State.Folder

const openSearch = () => bus.emit("tool", "search")

/** Right side of the TopBar on the Files page: plugin widgets, search, view. */
export const FilesTopRight = (props: { phone: boolean }) => {
  const t = useT()
  return (
    <>
      <PluginSlot name="header-right" />
      <Show
        when={!props.phone}
        fallback={
          <Show when={(searchOn() || layoutOn()) && !selectionMode()}>
            <DropdownMenu placement="bottom-end">
              <DropdownMenuTrigger
                aria-label={t("files.more")}
                data-files-more
                class={iconButton}
              >
                <TbDots class="size-5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <Show when={searchOn()}>
                  <DropdownMenuItem onSelect={openSearch} class="gap-2">
                    <TbFileSearch class="size-4" />
                    {t("home.search.search")}
                  </DropdownMenuItem>
                </Show>
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
              </DropdownMenuContent>
            </DropdownMenu>
          </Show>
        }
      >
        <Show when={searchOn()}>
          <Tooltip placement="bottom">
            <TooltipTrigger
              as="button"
              type="button"
              aria-label={t("home.search.search")}
              data-files-search
              onClick={openSearch}
              class={iconButton}
            >
              <TbFileSearch class="size-5" />
            </TooltipTrigger>
            <TooltipContent>{t("home.search.search")}</TooltipContent>
          </Tooltip>
        </Show>
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
