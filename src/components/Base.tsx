import { Box, Center, Flex, Heading, IconButton, VStack } from "@hope-ui/solid"
import { SwitchColorMode } from "./SwitchColorMode"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select"
import {
  mergeProps,
  Show,
  JSXElement,
  createSignal,
  onMount,
  onCleanup,
} from "solid-js"
import { AiOutlineFullscreen, AiOutlineFullscreenExit } from "solid-icons/ai"
import { BsFullscreen, BsFullscreenExit } from "solid-icons/bs"
import { useT } from "~/hooks"
import { createDisclosure, Tooltip } from "~/components/overlay"
import { colorModeValue } from "~/store/color-mode"

export const Error = (props: {
  msg: string
  disableColor?: boolean
  h?: string
  actions?: JSXElement
}) => {
  const merged = mergeProps(
    {
      h: "$full",
    },
    props,
  )
  return (
    <Center h={merged.h} p="$2" flexDirection="column">
      <Box
        rounded="$lg"
        px="$4"
        py="$6"
        bgColor={colorModeValue("white", "$neutral3")()}
        css={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "$4",
        }}
      >
        <Heading
          css={{
            wordBreak: "break-all",
          }}
        >
          {props.msg}
        </Heading>
        <Show when={props.actions}>
          <Flex mt="$4" justifyContent="center">
            {props.actions}
          </Flex>
        </Show>
        <Show when={!props.disableColor}>
          <Flex mt="$2" justifyContent="end">
            <SwitchColorMode />
          </Flex>
        </Show>
      </Box>
    </Center>
  )
}

export const BoxWithFullScreen = (
  props: Parameters<typeof Box>[0] & { extraButtons?: JSXElement },
) => {
  const { isOpen: isFullView, onToggle } = createDisclosure()
  const [isFullScreen, setIsFullScreen] = createSignal(false)
  let containerRef: HTMLDivElement
  const t = useT()

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef!.requestFullscreen()
    } else {
      document.exitFullscreen()
    }
  }

  onMount(() => {
    const fsHandler = () => setIsFullScreen(!!document.fullscreenElement)
    document.addEventListener("fullscreenchange", fsHandler)
    onCleanup(() => {
      document.removeEventListener("fullscreenchange", fsHandler)
    })
  })

  return (
    <Box
      ref={containerRef!}
      pos={isFullView() ? "fixed" : "relative"}
      w={isFullView() ? "100vw" : props.w}
      h={isFullView() ? "100vh" : props.h}
      top={0}
      left={0}
      zIndex={isFullView() ? "$modal" : undefined}
      transition="all 0.2s ease-in-out"
      css={{
        backdropFilter: isFullView() ? "blur(5px)" : undefined,
      }}
    >
      {props.children}
      <VStack
        pos="absolute"
        right="$2"
        bottom="$2"
        spacing="$2"
        opacity="0.7"
        _hover={{ opacity: "1" }}
        transition="opacity 0.3s ease"
        pointerEvents="auto"
        zIndex="$docked"
      >
        {props.extraButtons}
        <Show when={!isFullScreen()}>
          {/* Full view toggle */}
          <Tooltip
            label={
              isFullView()
                ? t("home.preview.exit_fullview")
                : t("home.preview.fullview")
            }
            withArrow
          >
            <IconButton
              aria-label={
                isFullView()
                  ? t("home.preview.exit_fullview")
                  : t("home.preview.fullview")
              }
              icon={isFullView() ? <BsFullscreenExit /> : <BsFullscreen />}
              onClick={onToggle}
              colorScheme="neutral"
              size="sm"
            />
          </Tooltip>
        </Show>

        {/* Native fullscreen toggle */}
        <Tooltip
          label={
            isFullScreen()
              ? t("home.preview.exit_fullscreen")
              : t("home.preview.fullscreen")
          }
          withArrow
        >
          <IconButton
            aria-label={
              isFullScreen()
                ? t("home.preview.exit_fullscreen")
                : t("home.preview.fullscreen")
            }
            icon={
              isFullScreen() ? (
                <AiOutlineFullscreenExit />
              ) : (
                <AiOutlineFullscreen />
              )
            }
            onClick={toggleFullscreen}
            colorScheme="neutral"
            size="sm"
          />
        </Tooltip>
      </VStack>
    </Box>
  )
}

/**
 * A select of plain options, on the kit's Select (Kobalte), so it works
 * inside the kit's dialogs and sheets: a hope Select portals its list out
 * of the dialog, where Kobalte's modal layer makes it unclickable
 * (PLAN_FE_UNIFY_OVERLAYS_1126 §2.2 E).
 */
export function SelectWrapper<T extends string | number>(props: {
  value: T | undefined
  onChange: (v: T) => void
  options: {
    value: T
    label?: string
  }[]
  placeholder?: string
  id?: string
}) {
  type Option = { value: T; label?: string }
  const text = (o: Option | undefined) =>
    o ? (o.label ?? String(o.value)) : ""
  return (
    <Select<Option>
      options={props.options}
      optionValue={(o) => String(o.value)}
      optionTextValue={text}
      value={props.options.find((o) => o.value === props.value)}
      onChange={(o) => {
        if (o) props.onChange(o.value)
      }}
      disallowEmptySelection
      placeholder={props.placeholder}
      itemComponent={(p) => (
        <SelectItem item={p.item}>{text(p.item.rawValue)}</SelectItem>
      )}
    >
      <SelectTrigger id={props.id}>
        <SelectValue<Option>>{(s) => text(s.selectedOption())}</SelectValue>
      </SelectTrigger>
      <SelectContent />
    </Select>
  )
}
