import {
  ElementType,
  HStack,
  Icon,
  IconProps,
  Text,
  Tooltip,
} from "@hope-ui/solid"
import { Show } from "solid-js"
import { IconTypes } from "solid-icons"
import { useT } from "~/hooks"
import { getMainColor, me } from "~/store"
import { UserMethods, UserPermissions } from "~/types"
import { hoverColor, isTouchDevice } from "~/utils"
import { operations } from "./operations"

export const CenterIcon = <C extends ElementType = "svg">(
  props: IconProps<C> & {
    name: string
  },
) => {
  const index = UserPermissions.findIndex((p) => p === props.name)
  if (index !== -1 && !UserMethods.can(me(), index)) return null
  const t = useT()
  // On touch devices, tooltips are never shown on hover. Render an inline
  // icon+label row instead so every action is self-describing.
  const inlineLabel = isTouchDevice()
  return (
    <Show
      when={inlineLabel}
      fallback={
        <Tooltip
          placement="top"
          withArrow
          label={t(`home.toolbar.${props.name}`)}
        >
          <Icon
            class={`toolbar-${props.name}`}
            _hover={{
              bgColor: hoverColor(),
            }}
            _focus={{
              outline: "none",
            }}
            cursor="pointer"
            boxSize="$7"
            rounded="$md"
            p={operations[props.name]?.p ? "$1_5" : "$1"}
            _active={{
              transform: "scale(.94)",
              transition: "0.2s",
            }}
            as={operations[props.name]?.icon}
            color={operations[props.name]?.color}
            {...props}
          />
        </Tooltip>
      }
    >
      <HStack
        class={`toolbar-${props.name} toolbar-center-touch-item`}
        spacing="$1"
        px="$2"
        py="$1_5"
        rounded="$md"
        cursor="pointer"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        _hover={{ bgColor: hoverColor() }}
        _active={{ transform: "scale(.94)", transition: "0.2s" }}
        onClick={props.onClick as any}
      >
        <Icon
          as={operations[props.name]?.icon}
          color={operations[props.name]?.color}
          boxSize="$6"
          p={operations[props.name]?.p ? "$0_5" : "0"}
        />
        <Text
          fontSize="$2xs"
          lineHeight="1"
          color={operations[props.name]?.color ?? "$neutral11"}
          css={{ whiteSpace: "nowrap" }}
        >
          {t(`home.toolbar.${props.name}`)}
        </Text>
      </HStack>
    </Show>
  )
}

export const RightIcon = <C extends ElementType = "svg">(
  props: IconProps<C> & {
    tips?: string
    icon?: IconTypes
  },
) => {
  const t = useT()
  // Touch devices can't hover, so the tooltip never appears. When a label
  // exists, surface it inline as a labeled row instead of a bare icon.
  const inlineLabel = isTouchDevice() && !!props.tips
  return (
    <Show
      when={inlineLabel}
      fallback={
        <Tooltip
          disabled={!props.tips}
          placement="left"
          withArrow
          label={t(`home.toolbar.${props.tips}`)}
        >
          <Icon
            // bgColor="$info4"
            color={getMainColor()}
            _hover={{
              bgColor: getMainColor(),
              color: "white",
            }}
            _focus={{
              outline: "none",
            }}
            cursor="pointer"
            boxSize="$8"
            rounded="$lg"
            p="$1"
            _active={{
              transform: "scale(.94)",
              transition: "0.2s",
            }}
            as={props.icon}
            {...props}
          />
        </Tooltip>
      }
    >
      <HStack
        class="toolbar-touch-item"
        w="$full"
        spacing="$2"
        px="$2"
        py="$1"
        rounded="$lg"
        cursor="pointer"
        color={getMainColor()}
        justifyContent="flex-start"
        _hover={{ bgColor: getMainColor(), color: "white" }}
        _active={{ transform: "scale(.97)", transition: "0.15s" }}
        onClick={props.onClick as any}
      >
        <Icon as={props.icon} boxSize="$7" p="$1" />
        <Text fontSize="$sm" css={{ whiteSpace: "nowrap" }}>
          {t(`home.toolbar.${props.tips}`)}
        </Text>
      </HStack>
    </Show>
  )
}

// export const ToolIcon = <C extends ElementType = "button">(
//   props: IconButtonProps<C>
// ) => <IconButton {...props} compact />;
