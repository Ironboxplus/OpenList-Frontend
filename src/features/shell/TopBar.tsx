import { useColorMode } from "@hope-ui/solid"
import {
  TbBell,
  TbLayoutSidebarLeftCollapse,
  TbLayoutSidebarLeftExpand,
  TbListDetails,
  TbLogout,
  TbMoon,
  TbSearch,
  TbSettings,
  TbSun,
  TbUserCircle,
} from "solid-icons/tb"
import { For, Show } from "solid-js"
import { Motion } from "solid-motionone"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { focusRing } from "~/components/ui/focus"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip"
import { useT } from "~/hooks"
import { getSetting, me } from "~/store"
import { cn } from "~/utils/cn"
import { attentionRing, prefersReducedMotion } from "~/utils/motion-presets"
import { errorCenter } from "../notifications/service"
import { setErrorCenterOpen } from "../notifications/state"
import { hotkeyLabel, setPaletteOpen } from "../palette/state"
import { useAccountActions } from "./account"
import { CountBadge, NavBadge } from "./NavBadge"
import { NavLink } from "./NavLink"
import { activeNavId, NAV_ITEMS } from "./nav-items"
import { nudge, setTaskCenterOpen, taskCenterOpen } from "./task-center"
import { TOOLBAR_ROW_HEIGHT, topBarSlots } from "./topbar-slot"

const iconButton = cn(
  focusRing,
  "relative inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-transparent text-muted-foreground no-underline transition-colors hover:bg-accent hover:text-accent-foreground",
)

/** The site logo (the first line of the setting is the light one, the last the dark one). */
const SiteLogo = () => {
  const { colorMode } = useColorMode()
  const src = () => {
    const logos = getSetting("logo").split("\n")
    return (colorMode() === "dark" ? logos[logos.length - 1] : logos[0])?.trim()
  }
  return (
    <Show when={src()}>
      <img src={src()} alt="" class="h-8 w-auto max-w-[9rem] object-contain" />
    </Show>
  )
}

/** Opens the command palette; `/` does too (AppShell listens for the key). */
const SearchBox = () => {
  const t = useT()
  return (
    <button
      type="button"
      aria-label={t("palette.open")}
      title={`${t("palette.open")} · ${hotkeyLabel()}`}
      data-palette-trigger
      onClick={() => setPaletteOpen(true)}
      class={cn(
        focusRing,
        "flex h-10 w-56 shrink-0 items-center gap-2 rounded-lg border bg-card px-3 text-sm text-muted-foreground transition-colors hover:bg-accent/50 lg:w-64",
      )}
    >
      <TbSearch class="size-4 shrink-0 text-primary" />
      <span class="truncate">{t("shell.search_hint")}</span>
      <kbd class="ml-auto rounded border bg-muted px-1.5 text-xs">/</kbd>
    </button>
  )
}

const PhoneSearchButton = () => {
  const t = useT()
  return (
    <button
      type="button"
      aria-label={t("palette.open")}
      data-palette-trigger
      onClick={() => setPaletteOpen(true)}
      class={iconButton}
    >
      <TbSearch class="size-5" />
    </button>
  )
}

/** The shell's own buttons: tasks, errors, theme, settings and the account menu. */
const ShellButtons = () => {
  const t = useT()
  const account = useAccountActions()
  const { colorMode } = useColorMode()
  // Reduced motion: no ring; the badge count still changes.
  const rings = () => (nudge() > 0 && !prefersReducedMotion() ? [nudge()] : [])
  return (
    <>
      <Tooltip placement="bottom">
        <TooltipTrigger
          as="button"
          type="button"
          aria-label={t("shell.task_center.title")}
          aria-expanded={taskCenterOpen()}
          onClick={() => {
            setTaskCenterOpen(true)
          }}
          class={iconButton}
        >
          <TbListDetails class="size-5" />
          {/* a new nudge value is a new item: a fresh ring mounts and plays once */}
          <For each={rings()}>
            {() => (
              <Motion.span
                data-testid="task-nudge"
                aria-hidden="true"
                class="pointer-events-none absolute inset-0 rounded-full bg-primary/40"
                {...(attentionRing as any)}
              />
            )}
          </For>
          <NavBadge class="absolute right-0.5 top-0.5" />
        </TooltipTrigger>
        <TooltipContent>{t("shell.task_center.title")}</TooltipContent>
      </Tooltip>
      <Tooltip placement="bottom">
        <TooltipTrigger
          as="button"
          type="button"
          aria-label={t("shell.error_center.open")}
          data-error-center-trigger
          onClick={() => setErrorCenterOpen(true)}
          class={iconButton}
        >
          <TbBell class="size-5" />
          <CountBadge
            testid="error-badge"
            count={errorCenter.unreadCount()}
            label={t("shell.error_center.unread", {
              count: errorCenter.unreadCount(),
            })}
            class="absolute right-0.5 top-0.5 bg-destructive text-destructive-foreground"
          />
        </TooltipTrigger>
        <TooltipContent>{t("shell.error_center.title")}</TooltipContent>
      </Tooltip>
      <Tooltip placement="bottom">
        <TooltipTrigger
          as="button"
          type="button"
          aria-label={t("shell.nav.toggle_theme")}
          onClick={account.toggleTheme}
          class={iconButton}
        >
          <Show
            when={colorMode() === "dark"}
            fallback={<TbMoon class="size-5" />}
          >
            <TbSun class="size-5" />
          </Show>
        </TooltipTrigger>
        <TooltipContent>{t("shell.nav.toggle_theme")}</TooltipContent>
      </Tooltip>
      <NavLink
        path="/@manage"
        aria-label={t("shell.nav.settings")}
        title={t("shell.nav.settings")}
        class={iconButton}
      >
        <TbSettings class="size-5" />
      </NavLink>
      <DropdownMenu placement="bottom-end">
        <DropdownMenuTrigger
          aria-label={t("shell.nav.account")}
          class={cn(
            focusRing,
            "ml-1 inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-medium uppercase text-primary-foreground",
          )}
        >
          {me().username?.slice(0, 1)}
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={account.profile} class="gap-2">
            <TbUserCircle class="size-4" />
            {t("shell.nav.profile")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={account.logout}
            class="gap-2 text-destructive"
          >
            <TbLogout class="size-4" />
            {t("manage.logout")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}

/** Phone: one row. The page's `toolbar` if it has one, else its slots and the title. */
const PhoneBar = (props: { title: string }) => {
  const ctx = { phone: true }
  return (
    <>
      <div class="flex min-w-0 flex-1 items-center pl-3">
        <Show
          when={topBarSlots()?.toolbar}
          fallback={
            <Show
              when={topBarSlots()?.left}
              fallback={
                <span class="px-1.5 text-sm font-medium text-foreground">
                  {props.title}
                </span>
              }
            >
              {(left) => left()(ctx)}
            </Show>
          }
        >
          {(toolbar) => toolbar()(ctx)}
        </Show>
      </div>
      <Show when={!topBarSlots()?.toolbar && topBarSlots()?.right}>
        {(right) => right()(ctx)}
      </Show>
      <PhoneSearchButton />
    </>
  )
}

/** Tablet and desktop: logo cell, the page's left slot and the search box, then the right buttons. */
const WideBar = (props: {
  title: string
  navWidth: string
  rail?: boolean
  onToggle?: () => void
}) => {
  const t = useT()
  const ctx = { phone: false }
  return (
    <>
      <div
        class="flex shrink-0 items-center gap-1 pl-[var(--shell-left)] pr-2"
        style={{ width: `calc(${props.navWidth} + var(--shell-left))` }}
      >
        <NavLink
          path="/"
          aria-label={getSetting("site_title")}
          class="flex min-w-0 flex-1 items-center rounded-lg px-2 py-1 no-underline"
        >
          <SiteLogo />
        </NavLink>
        <Show when={props.onToggle}>
          <button
            type="button"
            onClick={props.onToggle}
            aria-label={t(
              props.rail ? "shell.nav.expand" : "shell.nav.collapse",
            )}
            class={cn(iconButton, "size-8")}
          >
            <Show
              when={props.rail}
              fallback={<TbLayoutSidebarLeftCollapse class="size-5" />}
            >
              <TbLayoutSidebarLeftExpand class="size-5" />
            </Show>
          </button>
        </Show>
      </div>
      <div class="flex min-w-0 flex-1 items-center gap-3 pl-[var(--shell-gap)]">
        <Show
          when={topBarSlots()?.left}
          fallback={
            <span class="px-1.5 text-base font-medium text-foreground">
              {props.title}
            </span>
          }
        >
          {(left) => left()(ctx)}
        </Show>
        <Show when={!topBarSlots()?.hideSearch}>
          <SearchBox />
        </Show>
      </div>
      <div class="flex shrink-0 items-center gap-0.5">
        <Show when={topBarSlots()?.right}>{(right) => right()(ctx)}</Show>
        <ShellButtons />
      </div>
    </>
  )
}

/**
 * Cloudreve-style top of the signed-in shell, fixed over the canvas. Wide: the
 * logo (and the nav fold button) above the side nav; then what the page
 * registered (Files: the New menu or the selection actions) and the search box;
 * on the right the page's own widgets and the shell's buttons. A page's
 * `toolbar` slot becomes a second row over the content card.
 */
export const TopBar = (props: {
  pathname: string
  phone?: boolean
  /** Width of the side nav, which the logo cell lines up with. */
  navWidth: string
  rail?: boolean
  onToggle?: () => void
}) => {
  const t = useT()
  const title = () => {
    const id = activeNavId(props.pathname)
    const item = NAV_ITEMS.find((i) => i.id === id)
    return item ? t(item.labelKey) : ""
  }
  return (
    <>
      <header
        data-topbar
        class="fixed inset-x-0 top-0 z-[1150] flex items-center gap-2 bg-canvas pr-3"
        style={{ height: "var(--shell-header)" }}
      >
        <Show when={!props.phone} fallback={<PhoneBar title={title()} />}>
          <WideBar
            title={title()}
            navWidth={props.navWidth}
            rail={props.rail}
            onToggle={props.onToggle}
          />
        </Show>
      </header>
      <Show when={!props.phone && topBarSlots()?.toolbar}>
        {(toolbar) => (
          <div
            data-toolbar-row
            class="fixed z-[1150] flex items-center bg-canvas"
            style={{
              top: "var(--shell-header)",
              left: "var(--shell-content-left)",
              right: "var(--shell-content-right)",
              height: TOOLBAR_ROW_HEIGHT,
            }}
          >
            {toolbar()({ phone: false })}
          </div>
        )}
      </Show>
    </>
  )
}
