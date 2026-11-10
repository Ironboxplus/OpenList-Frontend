import { focusRing } from "~/components/ui/focus"
import { TbBell, TbLogout, TbSun, TbUserCircle } from "solid-icons/tb"
import { createEffect, createSignal, For, on, Show } from "solid-js"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet"
import { useT } from "~/hooks"
import { me } from "~/store"
import { cn } from "~/utils/cn"
import { useAccountActions } from "./account"
import { NavIconView } from "./icons"
import { errorCenter } from "../notifications/service"
import { setErrorCenterOpen } from "../notifications/state"
import { CountBadge, NavBadge } from "./NavBadge"
import { NavLink } from "./NavLink"
import { StorageCard } from "./StorageCard"
import {
  activeNavId,
  badgeTarget,
  navItemsFor,
  phoneTabItems,
} from "./nav-items"

export { TAB_BAR_HEIGHT } from "./viewport"
import { TAB_BAR_HEIGHT } from "./viewport"

const tabClass =
  focusRing +
  " relative flex flex-1 flex-col bg-transparent items-center justify-center gap-0.5 text-[11px] font-medium text-muted-foreground transition-colors"
const sheetRow =
  focusRing +
  " flex h-11 items-center gap-3 rounded-lg bg-transparent px-3 text-left text-sm text-foreground hover:bg-accent"

export const BottomTabs = (props: { pathname: string }) => {
  const t = useT()
  const account = useAccountActions()
  const [meOpen, setMeOpen] = createSignal(false)
  const active = () => activeNavId(props.pathname)
  // what the tab bar has no room for lives in the sheet
  const sheetNav = () => navItemsFor(me()).filter((i) => !i.phone)
  createEffect(
    on(
      () => props.pathname,
      () => setMeOpen(false),
      { defer: true },
    ),
  )

  return (
    <>
      <nav
        aria-label="main"
        class="fixed inset-x-0 bottom-0 z-[1200] flex border-t bg-card text-card-foreground"
        style={{
          height: `calc(${TAB_BAR_HEIGHT} + env(safe-area-inset-bottom))`,
          "padding-bottom": "env(safe-area-inset-bottom)",
        }}
      >
        <For each={phoneTabItems(me())}>
          {(item) => (
            <NavLink
              path={item.path}
              aria-current={active() === item.id ? "page" : undefined}
              class={cn(tabClass, active() === item.id && "text-primary")}
            >
              <span class="relative">
                <NavIconView icon={item.icon} />
                <Show when={badgeTarget(item.id)}>
                  <NavBadge class="absolute -right-2 -top-1" />
                </Show>
              </span>
              {t(item.labelKey)}
            </NavLink>
          )}
        </For>
        <button type="button" class={tabClass} onClick={() => setMeOpen(true)}>
          <TbUserCircle class="size-5" />
          {t("shell.nav.me")}
        </button>
      </nav>
      <Sheet open={meOpen()} onOpenChange={setMeOpen}>
        <SheetContent side="bottom" class="rounded-t-xl pb-8">
          <SheetHeader>
            <SheetTitle>{me().username}</SheetTitle>
          </SheetHeader>
          <div class="mt-4 flex flex-col gap-1">
            <For each={sheetNav()}>
              {(item) => (
                <NavLink
                  path={item.path}
                  aria-current={active() === item.id ? "page" : undefined}
                  class={sheetRow}
                >
                  <NavIconView icon={item.icon} />
                  {t(item.labelKey)}
                </NavLink>
              )}
            </For>
            <button
              type="button"
              class={sheetRow}
              onClick={() => {
                setMeOpen(false)
                account.profile()
              }}
            >
              <TbUserCircle class="size-5" />
              {t("shell.nav.profile")}
            </button>
            <button
              type="button"
              class={sheetRow}
              data-error-center-trigger
              onClick={() => {
                setMeOpen(false)
                setErrorCenterOpen(true)
              }}
            >
              <TbBell class="size-5" />
              {t("shell.error_center.title")}
              <CountBadge
                testid="error-badge"
                count={errorCenter.unreadCount()}
                class="ml-auto bg-destructive text-destructive-foreground"
              />
            </button>
            <button
              type="button"
              class={sheetRow}
              onClick={account.toggleTheme}
            >
              <TbSun class="size-5" />
              {t("shell.nav.toggle_theme")}
            </button>
            <button
              type="button"
              class={cn(sheetRow, "text-destructive")}
              onClick={() => {
                setMeOpen(false)
                void account.logout()
              }}
            >
              <TbLogout class="size-5" />
              {t("manage.logout")}
            </button>
          </div>
          <StorageCard class="mt-4" />
        </SheetContent>
      </Sheet>
    </>
  )
}
