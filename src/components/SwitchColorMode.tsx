import { useColorMode } from "@hope-ui/solid"
import { TbMoon, TbSun } from "solid-icons/tb"
import { Show } from "solid-js"
import { useT } from "~/hooks"
import { Button } from "~/components/ui/button"

const SwitchColorMode = () => {
  const t = useT()
  const { colorMode, toggleColorMode } = useColorMode()
  const label = () => t("common.switch_color_mode")
  return (
    <Button
      variant="ghost"
      size="icon"
      title={label()}
      aria-label={label()}
      onClick={toggleColorMode}
    >
      <Show when={colorMode() === "dark"} fallback={<TbMoon class="size-5" />}>
        <TbSun class="size-5" />
      </Show>
    </Button>
  )
}
export { SwitchColorMode }
