import {
  IconButton,
  Menu,
  MenuContent,
  MenuItem,
  MenuTrigger,
} from "@hope-ui/solid"
import { changeColor } from "seemly"
import { Link } from "@solidjs/router"
import { For, Show } from "solid-js"
import { Dynamic } from "solid-js/web"
import { CgProfile } from "solid-icons/cg"
import { FiLogOut } from "solid-icons/fi"
import { TbSettings } from "solid-icons/tb"
import { AnchorWithBase } from "~/components"
import { useFetch, useRouter, useT } from "~/hooks"
import { getMainColor, me } from "~/store"
import { PResp } from "~/types"
import { changeToken, handleResp, notify, r } from "~/utils"
import { userMenuEntries, type UserMenuEntryId } from "./user-menu"

const entryIcons: Record<UserMenuEntryId, typeof CgProfile> = {
  login: CgProfile,
  manage: TbSettings,
  logout: FiLogOut,
}

export const UserMenu = () => {
  const t = useT()
  const { to } = useRouter()
  const [logOutLoading, logOutReq] = useFetch(
    (): PResp<any> => r.get("/auth/logout"),
  )
  const logOut = async () => {
    handleResp(await logOutReq(), () => {
      changeToken()
      notify.success(t("manage.logout_success"))
      to(`/@login?redirect=${encodeURIComponent(location.pathname)}`)
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
        <AnchorWithBase as={Link} href={guestEntry()!.href!}>
          <IconButton
            aria-label="login"
            color={getMainColor()}
            bgColor={changeColor(getMainColor(), { alpha: 0.15 })}
            _hover={{ bgColor: changeColor(getMainColor(), { alpha: 0.2 }) }}
            compact
            size="lg"
            icon={<CgProfile />}
          />
        </AnchorWithBase>
      }
    >
      <Menu>
        <MenuTrigger
          as={IconButton}
          aria-label="user menu"
          compact
          size="lg"
          color={getMainColor()}
          bgColor={changeColor(getMainColor(), { alpha: 0.15 })}
          _hover={{ bgColor: changeColor(getMainColor(), { alpha: 0.2 }) }}
          icon={<CgProfile />}
        />
        <MenuContent>
          <For each={entries()}>
            {(entry) => (
              <MenuItem
                color={entry.danger ? "$danger9" : undefined}
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
