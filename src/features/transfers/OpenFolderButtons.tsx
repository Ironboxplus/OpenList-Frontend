import { Show } from "solid-js"
import { Button } from "~/components/ui/button"
import { useT } from "~/hooks"
import type { UnifiedTask } from "~/platform/contracts/task"
import { openTarget, type OpenTarget } from "../files/tasks-for-path"

/**
 * "Open source folder" / "open destination folder" for a task. Each button is
 * only there when that end is a path in the file tree (a sync job's local: end
 * is not), so the caller never has to special-case sync jobs.
 */
export const OpenFolderButtons = (props: {
  task: UnifiedTask
  onOpenPath?: (target: OpenTarget) => void
}) => {
  const t = useT()
  const source = () => openTarget(props.task, "source")
  const destination = () => openTarget(props.task, "destination")
  return (
    <Show when={props.onOpenPath && (source() || destination())}>
      <div class="flex flex-wrap justify-end gap-2">
        <Show when={source()}>
          {(target) => (
            <Button
              size="sm"
              variant="outline"
              data-action="open_source"
              onClick={(e: MouseEvent) => {
                e.stopPropagation()
                props.onOpenPath?.(target())
              }}
            >
              {t("transfers.action.open_source")}
            </Button>
          )}
        </Show>
        <Show when={destination()}>
          {(target) => (
            <Button
              size="sm"
              variant="outline"
              data-action="open_destination"
              onClick={(e: MouseEvent) => {
                e.stopPropagation()
                props.onOpenPath?.(target())
              }}
            >
              {t("transfers.action.open_destination")}
            </Button>
          )}
        </Show>
      </div>
    </Show>
  )
}
