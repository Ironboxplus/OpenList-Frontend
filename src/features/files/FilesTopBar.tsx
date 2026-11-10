import { LibraryBadge, LibraryMenuItem } from "./LibraryMenuItem"
import {
  TbArrowLeft,
  TbCheckbox,
  TbChevronDown,
  TbDots,
  TbHome,
  TbLayoutGrid,
  TbLayoutList,
  TbMovie,
  TbPhoto,
  TbRefresh,
  TbShare,
  TbColumns,
} from "solid-icons/tb"
import type { IconTypes } from "solid-icons"
import { createMemo, createSignal, For, Show } from "solid-js"
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
import { isTocVisible, setTocDisabled } from "~/components"
import { usePath, useRouter, useT } from "~/hooks"
import { PluginSlot } from "~/plugins"
import {
  haveSelected,
  layout,
  LayoutType,
  me,
  objStore,
  selectAll,
  setLayout,
  State,
  toggleCheckbox,
} from "~/store"
import { UserMethods } from "~/types"
import { cn } from "~/utils/cn"
import { joinBase } from "~/utils/path"
import { fileCrumbs, parentCrumb, type FileCrumb } from "./crumbs"
import {
  chooseView,
  hasPosterView,
  invalidateMedia,
  mediaReady,
  openMediaEditor,
  posterActive,
} from "../media/state"
import { Breadcrumb } from "../shell/Breadcrumb"
import { ButtonGroup, groupButton } from "./ButtonGroup"
import { FolderActionItems, NewMenu } from "./NewMenu"
import { PhoneSelectionHeader } from "./PhoneActions"
import { SelectionBar } from "./SelectionBar"
import { FolderSortMenu } from "./SortMenu"
import { runTool, useFileAbilities } from "./file-actions"
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

/** The folder being viewed: its name, and (where something can be created here) a menu of what. */
const CurrentCrumb = (props: { crumb: FileCrumb }) => {
  const can = useFileAbilities()
  return (
    <Show
      when={can.create() || can.offline()}
      fallback={<CrumbLabel crumb={props.crumb} />}
    >
      <DropdownMenu placement="bottom-start">
        <DropdownMenuTrigger
          data-files-crumb-menu
          class={cn(
            focusRing,
            "flex items-center gap-1 rounded-md bg-transparent text-sm font-medium text-foreground",
          )}
        >
          <CrumbLabel crumb={props.crumb} />
          <TbChevronDown class="size-3.5 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <FolderActionItems />
        </DropdownMenuContent>
      </DropdownMenu>
    </Show>
  )
}

/** Tablet/desktop: the shared breadcrumb over the folder path. */
const DesktopCrumbs = () => {
  const { crumbs } = useCrumbs()
  const { setPathAs } = usePath()
  const { to } = useRouter()
  return (
    <Breadcrumb
      attrs={{ "data-files-crumbs": "" }}
      items={crumbs().map((crumb, i, all) => ({
        href: crumb.href,
        current: i === all.length - 1,
        label:
          i === all.length - 1 ? (
            <CurrentCrumb crumb={crumb} />
          ) : (
            <CrumbLabel crumb={crumb} />
          ),
      }))}
      onNavigate={to}
      onHover={(href) => setPathAs(decodeURI(href))}
    />
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

/**
 * Left of the bar on tablet/desktop: the New menu, and next to it the
 * selection's actions while something is selected.
 */
export const FilesTopLeft = () => (
  <>
    <NewMenu />
    <Show when={haveSelected()}>
      <SelectionBar />
    </Show>
  </>
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

/** Admin-only: open the media editor for this folder. */
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

/** The "View" button: the layouts of the folder (and the media poster wall). */
const ViewMenu = (props: { labelClass?: string }) => {
  const t = useT()
  return (
    <DropdownMenu placement="bottom-end">
      <DropdownMenuTrigger
        aria-label={t("files.view")}
        title={t("files.view")}
        data-files-view
        class={groupButton}
      >
        <Dynamic
          component={posterActive() ? TbMovie : LAYOUTS[layout()]}
          class="size-4"
        />
        <span class={props.labelClass}>{t("files.view_label")}</span>
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
  )
}

/** Lists the folder again (and forgets what the media view cached for it). */
const useRefreshFolder = () => {
  const { refresh } = usePath()
  const { pathname } = useRouter()
  return () => {
    invalidateMedia(pathname())
    void refresh(undefined, true)
  }
}

const RefreshButton = () => {
  const t = useT()
  const refreshFolder = useRefreshFolder()
  return (
    <button
      type="button"
      data-action="refresh"
      aria-label={t("home.toolbar.refresh")}
      title={t("home.toolbar.refresh")}
      onClick={refreshFolder}
      class={groupButton}
    >
      <TbRefresh class="size-4" />
    </button>
  )
}

/** The rest of the folder's actions, which the old action row listed as buttons. */
const MoreMenu = (props: { phone?: boolean }) => {
  const t = useT()
  const can = useFileAbilities()
  const refreshFolder = useRefreshFolder()
  const tt = (key: string) => t(`home.toolbar.${key}`)
  return (
    <DropdownMenu placement="bottom-end">
      <DropdownMenuTrigger
        aria-label={t("files.more_actions")}
        title={t("files.more_actions")}
        data-action="more"
        data-files-more
        class={groupButton}
      >
        <TbDots class="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <Show when={props.phone}>
          <DropdownMenuItem onSelect={refreshFolder} class="gap-2">
            <TbRefresh class="size-4" />
            {tt("refresh")}
          </DropdownMenuItem>
        </Show>
        <Show when={can.move()}>
          <DropdownMenuItem onSelect={() => runTool("recursiveMove")}>
            {tt("recursive_move")}
          </DropdownMenuItem>
        </Show>
        <Show when={can.remove()}>
          <DropdownMenuItem onSelect={() => runTool("removeEmptyDirectory")}>
            {tt("remove_empty_directory")}
          </DropdownMenuItem>
        </Show>
        <Show when={can.rename()}>
          <DropdownMenuItem
            onSelect={() => {
              selectAll(true)
              runTool("batchRename")
            }}
          >
            {tt("batch_rename")}
          </DropdownMenuItem>
        </Show>
        <Show when={isTocVisible()}>
          <DropdownMenuItem onSelect={() => setTocDisabled((d) => !d)}>
            {tt("toggle_markdown_toc")}
          </DropdownMenuItem>
        </Show>
        <AdminMediaItem />
        <LibraryMenuItem />
        <DropdownMenuItem onSelect={toggleCheckbox} class="gap-2">
          <TbCheckbox class="size-4" />
          {tt("toggle_checkbox")}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => runTool("local_settings")}>
          {tt("local_settings")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * The row over the content card: the path as a rounded strip (its last folder
 * opens a menu of what to create there), then the refresh/more and view/sort
 * button groups. On a phone: the path strip and one group, or the selection
 * header while selecting.
 */
export const FilesToolbar = (props: { phone: boolean }) => {
  const t = useT()
  return (
    <div class="flex min-w-0 flex-1 items-center gap-3" data-files-toolbar>
      <Show
        when={!(props.phone && selectionMode())}
        fallback={<PhoneSelectionHeader />}
      >
        <div class="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-lg border bg-card pl-2 pr-3">
          <Show when={props.phone} fallback={<DesktopCrumbs />}>
            <PhoneCrumbs />
          </Show>
          <LibraryBadge />
        </div>
        <Show when={!props.phone}>
          <ButtonGroup>
            <RefreshButton />
            <MoreMenu />
          </ButtonGroup>
        </Show>
        <Show when={layoutOn()}>
          <ButtonGroup>
            <ViewMenu labelClass={props.phone ? "hidden" : undefined} />
            <FolderSortMenu
              class={groupButton}
              label={t("files.sort.title")}
              labelClass={props.phone ? "hidden" : undefined}
              placement="bottom-end"
            />
            <Show when={props.phone}>
              <MoreMenu phone />
            </Show>
          </ButtonGroup>
        </Show>
      </Show>
    </div>
  )
}

/** Right side of the bar on the Files page: plugin widgets. Searching is the shell's search box (the command palette offers "search this folder"). */
export const FilesTopRight = () => <PluginSlot name="header-right" />
