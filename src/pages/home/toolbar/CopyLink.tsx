import { Show } from "solid-js"
import { useT, useCopyLink } from "~/hooks"
import { CenterIcon } from "./Icon"
import { Menu, MenuTrigger, MenuContent, MenuItem } from "~/components/overlay"

export const CopyLink = () => {
  const t = useT()
  const {
    copySelectedPreviewPage,
    copySelectedRawLink,
    copySelectedMpvCommand,
    canCopyMpvCommand,
  } = useCopyLink()
  return (
    <Menu placement="top" offset={10}>
      <MenuTrigger as={CenterIcon} name="copy_link" />
      <MenuContent>
        <MenuItem
          onSelect={() => {
            copySelectedPreviewPage()
          }}
        >
          {t("home.toolbar.preview_page")}
        </MenuItem>
        <MenuItem
          onSelect={() => {
            copySelectedRawLink()
          }}
        >
          {t("home.toolbar.down_link")}
        </MenuItem>
        <MenuItem
          onSelect={() => {
            copySelectedRawLink(true)
          }}
        >
          {t("home.toolbar.encode_down_link")}
        </MenuItem>
        <Show when={canCopyMpvCommand()}>
          <MenuItem
            onSelect={() => {
              void copySelectedMpvCommand()
            }}
          >
            {t("home.toolbar.mpv_command")}
          </MenuItem>
        </Show>
      </MenuContent>
    </Menu>
  )
}
