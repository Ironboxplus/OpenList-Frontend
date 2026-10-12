import { createSignal, Show } from "solid-js"
import { Alert, AlertDescription } from "~/components/ui/alert"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog"
import {
  ConfirmDialog,
  FieldRenderer,
  SettingsSection,
} from "~/features/settings/form"
import { useFetch, useT } from "~/hooks"
import { Group, PEmptyResp, Type } from "~/types"
import {
  buildIndex,
  formatDate,
  handleRespWithNotifySuccess,
  r,
  updateIndex,
} from "~/utils"
import CommonSettings from "../settings/Common"
import { LineMdConfirmCircleTwotone, LineMdLoadingTwotoneLoop } from "./icons"
import { createProgressPoll } from "./progress"

type Progress = {
  obj_count: number
  is_done: boolean
  last_done_time: string
  error: string
}

const DEFAULT_MAX_DEPTH = 20

const Indexes = () => {
  const t = useT()
  const { progress, loading, refresh } = createProgressPoll<Progress>(
    "/admin/index/progress",
    // No index configured (404) is a steady state, not worth polling.
    (code) => code !== 404,
  )

  /** Run a job request, report its outcome, then show the new progress. */
  const job = (request: () => Promise<Awaited<PEmptyResp>>) => async () => {
    handleRespWithNotifySuccess(await request())
    refresh()
  }
  const [rebuildLoading, rebuildReq] = useFetch(buildIndex)
  const [clearLoading, clearReq] = useFetch((): PEmptyResp =>
    r.post("/admin/index/clear"),
  )
  const [stopLoading, stopReq] = useFetch((): PEmptyResp =>
    r.post("/admin/index/stop"),
  )
  const [updateLoading, updateReq] = useFetch(updateIndex)

  const [clearOpen, setClearOpen] = createSignal(false)
  const clear = async () => {
    await job(clearReq)()
    setClearOpen(false)
  }

  const [updateOpen, setUpdateOpen] = createSignal(false)
  const [updatePaths, setUpdatePaths] = createSignal("")
  const [updateDepth, setUpdateDepth] = createSignal(`${DEFAULT_MAX_DEPTH}`)
  const update = async () => {
    const paths = updatePaths() ? updatePaths().split("\n") : []
    const depth = updateDepth() ? parseInt(updateDepth()) : DEFAULT_MAX_DEPTH
    handleRespWithNotifySuccess(await updateReq(paths, depth))
    refresh()
  }

  return (
    <>
      <CommonSettings group={Group.INDEX} />
      <SettingsSection
        id="index-progress"
        title={t("indexes.current")}
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              disabled={loading()}
              onClick={refresh}
            >
              {t("global.refresh")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={clearLoading()}
              onClick={() => setClearOpen(true)}
            >
              {t("indexes.clear")}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={stopLoading()}
              onClick={job(stopReq)}
            >
              {t("indexes.stop")}
            </Button>
            <Button
              type="button"
              disabled={rebuildLoading()}
              onClick={job(rebuildReq)}
            >
              {t(`indexes.${progress()?.is_done ? "rebuild" : "build"}`)}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setUpdateOpen(true)}
            >
              {t("indexes.update")}
            </Button>
          </>
        }
      >
        <Show when={progress()}>
          {(p) => (
            <div class="flex flex-col gap-3 py-3 text-sm">
              <div class="flex items-center gap-3">
                {p().is_done ? (
                  <LineMdConfirmCircleTwotone class="size-8 shrink-0 text-primary" />
                ) : (
                  <LineMdLoadingTwotoneLoop class="size-8 shrink-0 text-primary" />
                )}
                <div class="flex flex-col gap-1">
                  <span>
                    {t("indexes.obj_count")}:{" "}
                    <Badge variant="outline">{p().obj_count}</Badge>
                  </span>
                  <span>
                    {t("indexes.last_done_time")}:{" "}
                    <Badge variant="secondary">
                      {p().last_done_time
                        ? formatDate(p().last_done_time)
                        : t("indexes.unknown")}
                    </Badge>
                  </span>
                </div>
              </div>
              <Show when={p().error}>
                <Alert variant="destructive">
                  <AlertDescription class="break-all">
                    {t("indexes.error")}: {p().error}
                  </AlertDescription>
                </Alert>
              </Show>
            </div>
          )}
        </Show>
      </SettingsSection>

      <ConfirmDialog
        open={clearOpen()}
        onOpenChange={setClearOpen}
        title={t("indexes.clear")}
        description={t("indexes.clear_confirm")}
        destructive
        loading={clearLoading()}
        onConfirm={clear}
      />
      <Dialog open={updateOpen()} onOpenChange={setUpdateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("indexes.update")}</DialogTitle>
            <DialogDescription class="sr-only">
              {t("indexes.update")}
            </DialogDescription>
          </DialogHeader>
          <FieldRenderer
            stacked
            field={{
              id: "update_paths",
              type: Type.Text,
              labelKey: "indexes.paths_to_update",
            }}
            value={updatePaths()}
            onChange={(raw) => setUpdatePaths(String(raw))}
          />
          <FieldRenderer
            stacked
            field={{
              id: "update_max_depth",
              type: Type.Number,
              labelKey: "indexes.max_depth",
            }}
            value={updateDepth()}
            onChange={(raw) => setUpdateDepth(String(raw))}
          />
          <DialogFooter>
            <Button type="button" disabled={updateLoading()} onClick={update}>
              {t("indexes.update")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default Indexes
