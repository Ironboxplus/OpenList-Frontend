import { Box, Heading, Icon, Text, VStack } from "@hope-ui/solid"
import { Link, useLocation } from "@solidjs/router"
import { IoHome } from "solid-icons/io"
import { BsGrid } from "solid-icons/bs"
import { createMemo, For, Show } from "solid-js"
import { AnchorWithBase } from "~/components"
import { useRouter, useT } from "~/hooks"
import {
  groupSettings,
  SETTINGS,
  routePath,
  visibleSettings,
  type SettingContribution,
} from "~/features/settings/registry"
import { me } from "~/store"
import { hoverColor, joinBase } from "~/utils"
import { IconTypes } from "solid-icons"
import { onClose } from "./Header"

const hashOf = (route: string) =>
  route.includes("#") ? "#" + route.split("#")[1] : ""
const KNOWN_HASHES = new Set(
  SETTINGS.map((s) => hashOf(s.route)).filter((h) => h !== ""),
)

interface MenuLinkProps {
  label: string
  to: string
  icon?: IconTypes
  active: boolean
  external?: true
  /** Leave the SPA with a full page load (used for "Home"). */
  refresh?: true
}

const MenuLink = (props: MenuLinkProps) => (
  <AnchorWithBase
    cancelBase={props.to.startsWith("http")}
    display="flex"
    as={Link}
    href={props.to}
    onClick={(e: any) => {
      onClose()
      if (props.refresh) {
        e.stopPropagation?.()
        e.preventDefault?.()
        window.open(joinBase(props.to), "_self")
      }
    }}
    w="$full"
    alignItems="center"
    _hover={{
      bgColor: props.active ? "$info4" : hoverColor(),
      textDecoration: "none",
    }}
    px="$2"
    py="$1_5"
    rounded="$md"
    cursor="pointer"
    bgColor={props.active ? "$info4" : ""}
    color={props.active ? "$info11" : ""}
    external={props.external}
    aria-current={props.active ? "page" : undefined}
  >
    <Show when={props.icon}>{<Icon mr="$2" as={props.icon} />}</Show>
    <Heading>{props.label}</Heading>
  </AnchorWithBase>
)

/**
 * Manage sidebar. Generated from the settings registry (the same list the
 * settings home and the command palette use): one block per group, only the
 * entries the current user may open.
 */
export const SideMenu = () => {
  const t = useT()
  const { pathname } = useRouter()
  const location = useLocation()
  const sections = createMemo(() => groupSettings(visibleSettings(me())))

  const isActive = (entry: SettingContribution) => {
    if (entry.external || pathname() !== routePath(entry.route)) return false
    // Two entries may share a page (plugins / cluster); the hash tells which.
    const hash = hashOf(entry.route)
    return hash ? location.hash === hash : !KNOWN_HASHES.has(location.hash)
  }

  return (
    <VStack p="$2" w="$full" color="$neutral11" spacing="$1" alignItems="stretch">
      <MenuLink
        label={t("settings.home.title")}
        to="/@manage"
        icon={BsGrid}
        active={pathname() === "/@manage"}
      />
      <For each={sections()}>
        {(section) => (
          <Box w="$full" pt="$2">
            <Text
              as="h2"
              px="$2"
              pb="$1"
              fontSize="$xs"
              fontWeight="$semibold"
              textTransform="uppercase"
              color="$neutral9"
            >
              {t(section.title)}
            </Text>
            <VStack w="$full" spacing="$1" alignItems="stretch">
              <For each={section.items}>
                {(entry) => (
                  <MenuLink
                    label={t(entry.title)}
                    to={entry.route}
                    icon={entry.icon}
                    active={isActive(entry)}
                    external={entry.external}
                  />
                )}
              </For>
            </VStack>
          </Box>
        )}
      </For>
      <Box w="$full" pt="$2">
        <MenuLink
          label={t("manage.sidemenu.home")}
          to="/"
          icon={IoHome}
          active={false}
          refresh
        />
      </Box>
    </VStack>
  )
}
