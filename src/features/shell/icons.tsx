import { TbFolder, TbArrowsUpDown, TbSettings } from "solid-icons/tb"
import { Dynamic } from "solid-js/web"
import type { NavIcon } from "./nav-items"

const ICONS = {
  files: TbFolder,
  transfers: TbArrowsUpDown,
  settings: TbSettings,
} as const

export const NavIconView = (props: { icon: NavIcon; class?: string }) => (
  <Dynamic component={ICONS[props.icon]} class={props.class ?? "size-5"} />
)
