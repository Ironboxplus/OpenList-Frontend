import { changeColor } from "seemly"
import { BsGridFill, BsCardImage, BsColumnsGap } from "solid-icons/bs"
import { FaSolidListUl } from "solid-icons/fa"
import { Switch, Match, For } from "solid-js"
import { Dynamic } from "solid-js/web"
import { useT } from "~/hooks"
import { getMainColor, LayoutType, layout, setLayout } from "~/store"
import { Menu, MenuContent, MenuItem, MenuTrigger } from "~/components/overlay"
import { Button } from "~/components/ui/button"

const layouts = {
  list: FaSolidListUl,
  grid: BsGridFill,
  image: BsCardImage,
  masonry: BsColumnsGap,
} as const

export const Layout = () => {
  const t = useT()
  return (
    <Menu>
      <MenuTrigger
        as={Button}
        variant="ghost"
        size="icon-lg"
        class="bg-(--tint) text-(--main) hover:bg-(--tint-hover) hover:text-(--main)"
        style={{
          "--main": getMainColor(),
          "--tint": changeColor(getMainColor(), { alpha: 0.15 }),
          "--tint-hover": changeColor(getMainColor(), { alpha: 0.2 }),
        }}
        aria-label="switch layout"
      >
        <Switch>
          <Match when={layout() === "list"}>
            <FaSolidListUl />
          </Match>
          <Match when={layout() === "grid"}>
            <BsGridFill />
          </Match>
          <Match when={layout() === "image"}>
            <BsCardImage />
          </Match>
          <Match when={layout() === "masonry"}>
            <BsColumnsGap />
          </Match>
        </Switch>
      </MenuTrigger>
      <MenuContent>
        <For each={Object.entries(layouts)}>
          {(item) => (
            <MenuItem
              icon={<Dynamic component={item[1]} />}
              onSelect={() => {
                setLayout(item[0] as LayoutType)
              }}
            >
              {t(`home.layouts.${item[0]}`)}
            </MenuItem>
          )}
        </For>
      </MenuContent>
    </Menu>
  )
}
