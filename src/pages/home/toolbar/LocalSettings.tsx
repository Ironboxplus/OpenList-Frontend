import {
  Center,
  FormControl,
  FormLabel,
  HStack,
  Input,
  VStack,
  Switch as HopeSwitch,
  IconButton,
  ButtonGroup,
} from "@hope-ui/solid"
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

function LocalSettingEdit(props: LocalSetting) {
  const t = useT()
  return (
    <FormControl>
      <FormLabel>{t(`home.local_settings.${props.key}`)}</FormLabel>
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
          <HopeSwitch
            defaultChecked={local[props.key] === "true"}
            onChange={(e: { currentTarget: HTMLInputElement }) => {
              setLocal(props.key, e.currentTarget.checked.toString())
            }}
          />
        </Match>
        <Match when={props.type === "number"}>
          <ButtonGroup attached>
            <IconButton
              aria-label="decrease"
              icon={<FaSolidMinus />}
              onClick={() => {
                setLocal(
                  props.key,
                  Math.max(1, parseInt(local[props.key]) - 1).toString(),
                )
              }}
            />
            <Input
              type="number"
              value={local[props.key]}
              onInput={(e) => {
                setLocal(props.key, e.currentTarget.value)
              }}
              borderRadius="$none"
              style={{
                "-moz-appearance": "textfield",
                // @ts-ignore
                "::-webkit-inner-spin-button": { display: "none" },
                "::-webkit-outer-spin-button": { display: "none" },
              }}
              class="hide-spin"
            />
            <IconButton
              aria-label="increase"
              icon={<FaSolidPlus />}
              onClick={() => {
                setLocal(props.key, (parseInt(local[props.key]) + 1).toString())
              }}
            />
          </ButtonGroup>
        </Match>
      </Switch>
    </FormControl>
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
          <VStack spacing="$2">
            <For each={initialLocalSettings.filter((s) => !s.hidden)}>
              {(setting) => <LocalSettingEdit {...setting} />}
            </For>
          </VStack>
          <Center mt="$4">
            <HStack spacing="$4" p="$2" color="$neutral11">
              <SwitchLanguageWhite />
              <SwitchColorMode />
            </HStack>
          </Center>
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  )
}
