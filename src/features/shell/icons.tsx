import {
  TbArrowsUpDown,
  TbFolder,
  TbLayoutDashboard,
  TbMovie,
  TbPlug,
  TbSettings,
} from "solid-icons/tb"
import { Dynamic } from "solid-js/web"
import type { NavIcon } from "./nav-items"

export const NAV_ICONS = {
  dashboard: TbLayoutDashboard,
  files: TbFolder,
  media: TbMovie,
  transfers: TbArrowsUpDown,
  plugins: TbPlug,
  settings: TbSettings,
} as const

export const NavIconView = (props: { icon: NavIcon; class?: string }) => (
  <Dynamic component={NAV_ICONS[props.icon]} class={props.class ?? "size-5"} />
)
