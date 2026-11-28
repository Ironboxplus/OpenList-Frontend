import { For, Match, onCleanup, Switch } from "solid-js"
import { FaSolidMinus, FaSolidPlus } from "solid-icons/fa"
import {
  SelectWrapper,
  SwitchLanguageWhite,
  SwitchColorMode,
} from "~/components"
import { useT } from "~/hooks"
import { initialLocalSettings, local, LocalSetting, setLocal } from "~/store"
import { bus } from "~/utils"
import {
  createDisclosure,
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerHeader,
  DrawerOverlay,
} from "~/components/overlay"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { SwitchField } from "~/components/ui/toggle-field"

function LocalSettingEdit(props: LocalSetting) {
  const t = useT()
  return (
    <div class="w-full relative">
      <label class="inline-block mb-1 text-sm leading-5 font-medium text-foreground">
        {t(`home.local_settings.${props.key}`)}
      </label>
      <Switch
        fallback={
          <Input
            value={local[props.key]}
            onInput={(e) => {
              setLocal(props.key, e.currentTarget.value)
            }}
          />
        }
      >
        <Match when={props.type === "select"}>
          <SelectWrapper
            id={props.key}
            value={local[props.key]}
            onChange={(v) => setLocal(props.key, v)}
            placeholder={t("global.not_set")}
            options={(props.options ?? []).map((item) => ({
              value: item,
              label: t(`home.local_settings.${props.key}_options.${item}`),
            }))}
          />
        </Match>
        <Match when={props.type === "boolean"}>
          <SwitchField
            aria-label={t(`home.local_settings.${props.key}`)}
            checked={local[props.key] === "true"}
            onChange={(on) => {
              setLocal(props.key, on.toString())
            }}
          />
        </Match>
        <Match when={props.type === "number"}>
          <div class="flex items-stretch">
            {/* 40px wide, as high: hope's IconButton was 31px (the audit's small-target) */}
            <Button
              variant="subtle"
              aria-label="decrease"
              size="icon-lg"
              class="rounded-r-none"
              onClick={() => {
                setLocal(
                  props.key,
                  Math.max(1, parseInt(local[props.key]) - 1).toString(),
                )
              }}
            >
              <FaSolidMinus />
            </Button>
            <Input
              class="rounded-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              type="number"
              value={local[props.key]}
              onInput={(e) => {
                setLocal(props.key, e.currentTarget.value)
              }}
            />
            <Button
              variant="subtle"
              aria-label="increase"
              size="icon-lg"
              class="rounded-l-none"
              onClick={() => {
                setLocal(props.key, (parseInt(local[props.key]) + 1).toString())
              }}
            >
              <FaSolidPlus />
            </Button>
          </div>
        </Match>
      </Switch>
    </div>
  )
}

export const LocalSettings = () => {
  const { isOpen, onOpen, onClose } = createDisclosure()
  const t = useT()
  const handler = (name: string) => {
    if (name === "local_settings") {
      onOpen()
    }
  }
  bus.on("tool", handler)
  onCleanup(() => {
    bus.off("tool", handler)
  })
  return (
    <Drawer opened={isOpen()} placement="right" onClose={onClose}>
      <DrawerOverlay />
      <DrawerContent>
        <DrawerCloseButton />
        <DrawerHeader color="$info9">
          {t("home.toolbar.local_settings")}
        </DrawerHeader>
        <DrawerBody>
          <div class="flex flex-col items-center gap-y-2">
            <For each={initialLocalSettings.filter((s) => !s.hidden)}>
              {(setting) => <LocalSettingEdit {...setting} />}
            </For>
          </div>
          <div class="flex justify-center items-center mt-4">
            <div class="flex flex-row items-center p-2 text-muted-foreground gap-x-4">
              <SwitchLanguageWhite />
              <SwitchColorMode />
            </div>
          </div>
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  )
}
