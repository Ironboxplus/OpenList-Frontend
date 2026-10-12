import { Show } from "solid-js"
import { Progress } from "~/components/ui/progress"
import { StatusBadge } from "~/components/ui/status-badge"
import { useT } from "~/hooks"
import { MountDetails, Storage } from "~/types"
import { plainText } from "~/utils/str"
import { nearlyFull, toReadableUsage, usedPercentage } from "~/utils"

/** "work" is healthy, "disabled" is off; anything else is the failure text. */
export const StorageStatus = (props: { storage: Storage }) => {
  const t = useT()
  return (
    <Show
      when={
        props.storage.status !== "work" && props.storage.status !== "disabled"
      }
      fallback={
        <StatusBadge
          tone={props.storage.status === "work" ? "success" : "neutral"}
          label={t(
            `storages.table_fields.status.${props.storage.status}`,
            undefined,
            props.storage.status,
          )}
        />
      }
    >
      <StatusBadge
        tone="error"
        label={t("common.error")}
        detail={plainText(props.storage.status)}
      />
    </Show>
  )
}

/** Used / total space with a bar that turns red when the disk is nearly full. */
export const StorageUsage = (props: { details: MountDetails | undefined }) => (
  <Show when={props.details}>
    {(details) => (
      <div class="flex min-w-32 flex-col gap-1">
        <Progress
          value={usedPercentage(details())}
          class="gap-0"
          fillClass={nearlyFull(details()) ? "bg-destructive" : undefined}
        />
        <span class="text-xs text-muted-foreground">
          {toReadableUsage(details())}
        </span>
      </div>
    )}
  </Show>
)
