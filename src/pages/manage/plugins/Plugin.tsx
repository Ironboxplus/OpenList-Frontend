import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Show } from "solid-js"
import { useRouter, useT } from "~/hooks"
import { PluginItem } from "~/types"
import { DeletePopover } from "../common/DeletePopover"
import { FaSolidPuzzlePiece } from "solid-icons/fa"
import { TableCell, TableRow } from "~/components/ui/table"

export interface PluginItemProps {
  plugin: PluginItem
  onConfig?: (plugin: PluginItem) => void
  onToggle: (plugin: PluginItem) => void
  onDelete: (plugin: PluginItem) => void
}

export function PluginOp(props: PluginItemProps) {
  const t = useT()
  const { to } = useRouter()
  return (
    <div class="flex flex-row items-center gap-x-2">
      <Button
        variant="subtle"
        size="sm"
        onClick={() => {
          to(`/@manage/plugins/config/${encodeURIComponent(props.plugin.id)}`)
        }}
      >
        {t("global.edit")}
      </Button>
      <Button
        size="sm"
        variant={props.plugin.enabled ? "warning" : "success"}
        onClick={() => {
          props.onToggle(props.plugin)
        }}
      >
        {t(`global.${props.plugin.enabled ? "disable" : "enable"}`)}
      </Button>
      <DeletePopover
        name={props.plugin.name}
        onClick={() => {
          props.onDelete(props.plugin)
        }}
      />
    </div>
  )
}

export function PluginListItem(props: PluginItemProps) {
  const t = useT()
  return (
    <TableRow>
      <TableCell>
        <div class="flex flex-row items-center gap-x-2">
          <div class="w-7 h-7 rounded-md bg-muted flex items-center justify-center shrink-0 overflow-hidden">
            <Show
              when={props.plugin.icon}
              fallback={<FaSolidPuzzlePiece size={14} />}
            >
              <img
                src={props.plugin.icon}
                alt="icon"
                style={{
                  width: "18px",
                  height: "18px",
                  "object-fit": "contain",
                }}
              />
            </Show>
          </div>
          <div class="flex flex-col items-start gap-y-0">
            <p class="font-medium">{props.plugin.name}</p>
            <p class="text-xs text-muted-foreground">{props.plugin.id}</p>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="secondary">{props.plugin.type || "ui"}</Badge>
      </TableCell>
      <TableCell>
        <p class="text-sm">v{props.plugin.version || "1.0.0"}</p>
      </TableCell>
      <TableCell>
        <p class="text-sm text-muted-foreground">
          {props.plugin.author || "Community"}
        </p>
      </TableCell>
      <TableCell>
        <div class="flex flex-row items-center gap-x-1">
          <Badge variant={props.plugin.enabled ? "success" : "secondary"}>
            {t(`global.${props.plugin.enabled ? "enable" : "disable"}`)}
          </Badge>
          <Show when={props.plugin.high_privilege}>
            <Badge variant="danger">Root</Badge>
          </Show>
        </div>
      </TableCell>
      <TableCell>
        <PluginOp {...props} />
      </TableCell>
    </TableRow>
  )
}

export function PluginGridItem(props: PluginItemProps) {
  const t = useT()

  return (
    <div
      class="flex w-full flex-col items-start justify-between gap-y-3 rounded-lg border bg-card p-3 shadow-sm dark:shadow-none"
      classList={{
        "border-destructive/40": props.plugin.high_privilege,
        "border-border": !props.plugin.high_privilege,
      }}
    >
      <div class="flex flex-col items-start w-full gap-y-1.5">
        <div class="flex flex-row items-center w-full justify-between gap-x-2">
          <div class="flex flex-row items-center gap-x-2">
            <div class="w-8 h-8 rounded-md bg-muted flex items-center justify-center shrink-0 overflow-hidden">
              <Show
                when={props.plugin.icon}
                fallback={<FaSolidPuzzlePiece size={16} />}
              >
                <img
                  src={props.plugin.icon}
                  alt="icon"
                  style={{
                    width: "20px",
                    height: "20px",
                    "object-fit": "contain",
                  }}
                />
              </Show>
            </div>
            <div class="flex flex-col items-start gap-y-0">
              <p class="font-bold text-sm">{props.plugin.name}</p>
              <p class="text-xs text-muted-foreground">{props.plugin.id}</p>
            </div>
          </div>
          <div class="flex flex-row items-center gap-x-1">
            <Badge variant={props.plugin.enabled ? "success" : "secondary"}>
              {t(`global.${props.plugin.enabled ? "enable" : "disable"}`)}
            </Badge>
            <Show when={props.plugin.high_privilege}>
              <Badge variant="danger">Root</Badge>
            </Show>
          </div>
        </div>

        <p class="text-xs text-muted-foreground line-clamp-2 min-h-[32px]">
          {props.plugin.description || t("plugins.empty_desc")}
        </p>

        <div class="flex flex-row items-center text-xs text-muted-foreground gap-x-2">
          <span>v{props.plugin.version || "1.0.0"}</span>
          <span>•</span>
          <span>{props.plugin.author || "Community"}</span>
          <span>•</span>
          <Badge variant="secondary">{props.plugin.type || "ui"}</Badge>
        </div>
      </div>

      <div class="flex flex-row items-center w-full justify-end gap-x-2">
        <PluginOp {...props} />
      </div>
    </div>
  )
}
