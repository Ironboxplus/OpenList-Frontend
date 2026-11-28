import { Show } from "solid-js"
import { Dynamic } from "solid-js/web"
import { IconTypes } from "solid-icons"
import { useT } from "~/hooks"
import { getMainColor, me } from "~/store"
import { UserMethods, UserPermissions } from "~/types"
import { isTouchDevice } from "~/utils"
import { cn } from "~/utils/cn"
import { operations } from "./operations"
import { Tooltip } from "~/components/overlay"

export const CenterIcon = (props: { name: string; onClick?: () => void }) => {
  const index = UserPermissions.findIndex((p) => p === props.name)
  if (index !== -1 && !UserMethods.can(me(), index)) return null
  const t = useT()
  // On touch devices, tooltips are never shown on hover. Render an inline
  // icon+label row instead so every action is self-describing.
  const inlineLabel = isTouchDevice()
  const op = () => operations[props.name]
  return (
    <Show
      when={inlineLabel}
      fallback={
        <Tooltip
          placement="top"
          withArrow
          label={t(`home.toolbar.${props.name}`)}
        >
          <Dynamic
            component={op()?.icon}
            class={cn(
              `toolbar-${props.name}`,
              "size-7 cursor-pointer rounded-md outline-none transition active:scale-[.94] hover:bg-accent",
              op()?.p ? "p-1.5" : "p-1",
              op()?.color,
            )}
            onClick={props.onClick}
          />
        </Tooltip>
      }
    >
      <div
        class={cn(
          `toolbar-${props.name} toolbar-center-touch-item`,
          "flex cursor-pointer flex-col items-center justify-center gap-y-1 rounded-md px-2 py-1.5 transition active:scale-[.94] hover:bg-accent",
        )}
        onClick={props.onClick}
      >
        <Dynamic
          component={op()?.icon}
          class={cn("size-6", op()?.p ? "p-0.5" : "p-0", op()?.color)}
        />
        <p
          class={cn(
            "text-[0.625rem] leading-none whitespace-nowrap",
            op()?.color ?? "text-muted-foreground",
          )}
        >
          {t(`home.toolbar.${props.name}`)}
        </p>
      </div>
    </Show>
  )
}

export const RightIcon = (props: {
  icon: IconTypes
  tips?: string
  class?: string
  onClick?: () => void
}) => {
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
          <Dynamic
            component={props.icon}
            class={cn(
              "size-8 cursor-pointer rounded-lg p-1 text-(--main) outline-none transition active:scale-[.94] hover:bg-(--main) hover:text-white",
              props.class,
            )}
            style={{ "--main": getMainColor() }}
            onClick={props.onClick}
          />
        </Tooltip>
      }
    >
      <div
        class="toolbar-touch-item flex w-full cursor-pointer items-center justify-start gap-x-2 rounded-lg px-2 py-1 text-(--main) transition active:scale-[.97] hover:bg-(--main) hover:text-white"
        style={{ "--main": getMainColor() }}
        onClick={props.onClick}
      >
        <Dynamic component={props.icon} class="size-7 p-1" />
        <p class="text-sm whitespace-nowrap">
          {t(`home.toolbar.${props.tips}`)}
        </p>
      </div>
    </Show>
  )
}
