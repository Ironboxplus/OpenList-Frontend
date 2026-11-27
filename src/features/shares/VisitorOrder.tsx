// The order a share's visitors see its files in (plan §0.2 分享弹窗, 11-27):
// the three settings the backend keeps (order_by, order_direction,
// extract_folder) as one control — the basis as joined buttons, ascending or
// descending beside it, and a switch for folders on top. Empty values are the
// backend's defaults (OP internal/model/obj.go) and are named for what they do.
// One control for the share dialog and the share form.
import { TbSortAscending, TbSortDescending } from "solid-icons/tb"
import { Show } from "solid-js"
import { Segmented } from "~/components/ui/segmented"
import {
  Switch,
  SwitchControl,
  SwitchLabel,
  SwitchThumb,
} from "~/components/ui/switch"
import { useT } from "~/hooks"
import { cn } from "~/utils/cn"

export interface VisitorOrderValue {
  order_by: string
  order_direction: string
  extract_folder: string
}

/** How many of the three settings are not at the backend's default. */
export const orderChanges = (v: Partial<VisitorOrderValue>) =>
  [v.order_by, v.order_direction, v.extract_folder].filter((x) => !!x).length

type Basis = "" | "name" | "size" | "modified"

export const VisitorOrder = (props: {
  value: Partial<VisitorOrderValue>
  onChange: (patch: Partial<VisitorOrderValue>) => void
}) => {
  const t = useT()
  const basis = () => (props.value.order_by ?? "") as Basis
  const desc = () =>
    (props.value.order_direction ?? "").toLowerCase() === "desc"
  const folder = () => props.value.extract_folder ?? ""
  return (
    <div class="grid gap-2" data-testid="share-order">
      <div class="flex flex-wrap items-center gap-2">
        <Segmented<Basis>
          label={t("shares.order_by")}
          value={basis()}
          items={[
            { value: "", label: t("shares.order_by_default") },
            { value: "name", label: t("shares.order_bys.name") },
            { value: "size", label: t("shares.order_bys.size") },
            { value: "modified", label: t("shares.order_bys.modified") },
          ]}
          onChange={(v) =>
            props.onChange(
              v
                ? {
                    order_by: v,
                    order_direction: props.value.order_direction || "asc",
                  }
                : { order_by: "", order_direction: "" },
            )
          }
        />
        <button
          type="button"
          data-testid="share-order-direction"
          aria-label={t("shares.order_direction")}
          aria-pressed={desc()}
          disabled={!basis()}
          class={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-md border bg-transparent px-2.5 text-sm transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-50",
          )}
          onClick={() =>
            props.onChange({ order_direction: desc() ? "asc" : "desc" })
          }
        >
          <Show when={desc()} fallback={<TbSortAscending class="size-4" />}>
            <TbSortDescending class="size-4" />
          </Show>
          {desc()
            ? t("shares.order_directions.desc")
            : basis()
              ? t("shares.order_directions.asc")
              : t("shares.order_direction_default")}
        </button>
      </div>
      <Switch
        class="flex items-center gap-2"
        checked={folder() === "front"}
        onChange={(on) => props.onChange({ extract_folder: on ? "front" : "" })}
      >
        <SwitchControl>
          <SwitchThumb />
        </SwitchControl>
        <SwitchLabel class="text-sm">
          {t("shares.extract_folders.front")}
        </SwitchLabel>
        <span
          class="text-xs text-muted-foreground"
          data-testid="share-order-folders"
        >
          {folder() === "back"
            ? t("shares.extract_folders.back")
            : folder() === "front"
              ? ""
              : t("shares.extract_folder_default")}
        </span>
      </Switch>
    </div>
  )
}
