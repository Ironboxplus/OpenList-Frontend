import { TbCheck } from "solid-icons/tb"
import { Show } from "solid-js"
import { Dynamic } from "solid-js/web"
import { getMainColor } from "~/store"
import type { StoreObj } from "~/types"
import { cn } from "~/utils/cn"
import { formatDateCompact, getFileSize, toReadableUsage } from "~/utils"
import { getIconByObj } from "~/utils/icon"
import { selectionMode } from "./selection-mode"

/**
 * Phone row: icon, name, and one line of meta (size and date). The whole row
 * is the touch target; the hope-ui row around it supplies the link and the
 * selection behaviour. In selection mode a round check replaces the icon slot.
 */
export const PhoneRowBody = (props: { obj: StoreObj }) => {
  const size = () =>
    props.obj.mount_details
      ? toReadableUsage(props.obj.mount_details)
      : props.obj.is_dir
        ? ""
        : getFileSize(props.obj.size)
  const meta = () =>
    [size(), props.obj.modified ? formatDateCompact(props.obj.modified) : ""]
      .filter(Boolean)
      .join(" · ")
  return (
    <div class="flex w-full min-w-0 items-center gap-3" data-phone-row>
      <Show
        when={selectionMode()}
        fallback={
          <Dynamic
            component={getIconByObj(props.obj)}
            class="size-7 shrink-0"
            style={{ color: getMainColor() }}
          />
        }
      >
        <span
          data-row-check
          class={cn(
            "inline-flex size-7 shrink-0 items-center justify-center rounded-full border-2",
            props.obj.selected
              ? "border-primary bg-primary text-primary-foreground"
              : "border-muted-foreground/50",
          )}
        >
          <Show when={props.obj.selected}>
            <TbCheck class="size-4" />
          </Show>
        </span>
      </Show>
      <div class="flex min-w-0 flex-1 flex-col gap-0.5">
        <span class="name truncate text-sm font-medium" title={props.obj.name}>
          {props.obj.name}
        </span>
        <Show when={meta()}>
          <span class="truncate text-xs text-muted-foreground">{meta()}</span>
        </Show>
      </div>
    </div>
  )
}
