import { changeColor } from "seemly"
import { For, Show } from "solid-js"
import { Dynamic } from "solid-js/web"
import { CgProfile } from "solid-icons/cg"
import { FiLogOut } from "solid-icons/fi"
import { TbSettings } from "solid-icons/tb"
import { AnchorWithBase } from "~/components"
import { useFetch, useRouter, useT } from "~/hooks"
import { getMainColor, me } from "~/store"
import { PResp } from "~/types"
import { changeToken, handleResp, loginUrlFor, notify, r } from "~/utils"
import { userMenuEntries, type UserMenuEntryId } from "./user-menu"
import { Menu, MenuContent, MenuItem, MenuTrigger } from "~/components/overlay"
import { Button } from "~/components/ui/button"

const entryIcons: Record<UserMenuEntryId, typeof CgProfile> = {
  login: CgProfile,
  manage: TbSettings,
  logout: FiLogOut,
}

export const UserMenu = () => {
  const t = useT()
  const { to } = useRouter()
  const [logOutLoading, logOutReq] = useFetch((): PResp<any> =>
    r.get("/auth/logout"),
  )
  const logOut = async () => {
    handleResp(await logOutReq(), () => {
      changeToken()
      notify.success(t("manage.logout_success"))
      to(loginUrlFor(location))
    })
  }

  const entries = () => userMenuEntries(me())
  // A guest has a single action: render it as a plain button instead of a menu.
  const guestEntry = () => {
    const list = entries()
    return list.length === 1 && list[0].id === "login" ? list[0] : undefined
  }

  return (
    <Show
      when={!guestEntry()}
      fallback={
        <AnchorWithBase href={guestEntry()!.href!}>
          <Button
            aria-label="login"
            variant="ghost"
            size="icon-lg"
            class="bg-(--tint) text-(--main) hover:bg-(--tint-hover) hover:text-(--main)"
            style={{
              "--main": getMainColor(),
              "--tint": changeColor(getMainColor(), { alpha: 0.15 }),
              "--tint-hover": changeColor(getMainColor(), { alpha: 0.2 }),
            }}
          >
            <CgProfile />
          </Button>
        </AnchorWithBase>
      }
    >
      <Menu>
        <MenuTrigger
          as={Button}
          aria-label="user menu"
          variant="ghost"
          size="icon-lg"
          class="bg-(--tint) text-(--main) hover:bg-(--tint-hover) hover:text-(--main)"
          style={{
            "--main": getMainColor(),
            "--tint": changeColor(getMainColor(), { alpha: 0.15 }),
            "--tint-hover": changeColor(getMainColor(), { alpha: 0.2 }),
          }}
        >
          <CgProfile />
        </MenuTrigger>
        <MenuContent>
          <For each={entries()}>
            {(entry) => (
              <MenuItem
                danger={entry.danger}
                icon={<Dynamic component={entryIcons[entry.id]} />}
                disabled={entry.id === "logout" && logOutLoading()}
                onSelect={() => {
                  if (entry.kind === "action") {
                    logOut()
                  } else if (entry.href) {
                    to(entry.href)
                  }
                }}
              >
                {t(entry.labelKey)}
              </MenuItem>
            )}
          </For>
        </MenuContent>
      </Menu>
    </Show>
  )
}
