import { createEffect, For, onCleanup, Show, untrack } from "solid-js"
import { Button } from "~/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet"
import { useRouter, useT } from "~/hooks"
import { setTaskCenterOpen, taskCenterOpen } from "../shell/task-center"
import { drawerTasks } from "./adapter"
import { transfers } from "./service"
import { TaskCard } from "./TaskCard"

/** Global drawer (tablet/desktop): running and just-finished tasks at a glance. */
const TaskCenter = () => {
  const t = useT()
  const { to } = useRouter()

  // Opening the drawer counts as having seen the current failures, and asks
  // the store for its fast polling cadence while it stays open.
  createEffect(() => {
    if (!taskCenterOpen()) return
    // untrack: both calls read and write store signals, which would re-run
    // this effect forever.
    const release = untrack(() => {
      transfers.markFailedSeen()
      return transfers.watch()
    })
    onCleanup(release)
  })

  const list = () => drawerTasks(transfers.tasks(), Date.now())
  const goAll = () => {
    setTaskCenterOpen(false)
    to("/@transfers")
  }

  return (
    <Sheet open={taskCenterOpen()} onOpenChange={setTaskCenterOpen}>
      <SheetContent class="flex w-[420px] max-w-full flex-col gap-4 sm:max-w-[420px]">
        <SheetHeader>
          <SheetTitle>{t("shell.task_center.title")}</SheetTitle>
          <p class="text-sm text-muted-foreground">
            {t("shell.task_center.running", { count: transfers.activeCount() })}
          </p>
        </SheetHeader>
        <div
          class="flex flex-1 flex-col gap-3 overflow-y-auto"
          data-testid="task-center-list"
        >
          <Show
            when={list().length > 0}
            fallback={
              <p class="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                {t("shell.task_center.empty")}
              </p>
            }
          >
            <For each={list()}>
              {(tk) => <TaskCard task={tk} compact onOpen={goAll} />}
            </For>
          </Show>
        </div>
        <Button variant="outline" data-testid="task-center-all" onClick={goAll}>
          {t("shell.task_center.view_all")}
        </Button>
      </SheetContent>
    </Sheet>
  )
}

export default TaskCenter
