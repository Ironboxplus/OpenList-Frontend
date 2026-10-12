import { createSignal, Show } from "solid-js"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import {
  driverFromRaw,
  FieldRenderer,
  SettingsSection,
} from "~/features/settings/form"
import { useFetch, useT } from "~/hooks"
import { PEmptyResp, Type } from "~/types"
import { handleRespWithNotifySuccess, r } from "~/utils"
import { createProgressPoll } from "./progress"

type Progress = {
  obj_count: number
  is_done: boolean
}

const Scan = () => {
  const t = useT()
  const { progress, loading, refresh } = createProgressPoll<Progress>(
    "/admin/scan/progress",
  )
  const [stopLoading, stopReq] = useFetch((): PEmptyResp =>
    r.post("/admin/scan/stop"),
  )
  const stop = async () => {
    handleRespWithNotifySuccess(await stopReq())
    refresh()
  }
  const [scanPath, setScanPath] = createSignal("/")
  const [rateLimit, setRateLimit] = createSignal(0.0)
  const [startLoading, startReq] = useFetch((): PEmptyResp =>
    r.post("/admin/scan/start", { path: scanPath(), limit: rateLimit() }),
  )
  const start = async () => {
    handleRespWithNotifySuccess(await startReq())
    refresh()
  }
  return (
    <SettingsSection
      id="scan"
      title={t("indexes.scan_header")}
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
            disabled={stopLoading() || progress()?.is_done}
            onClick={stop}
          >
            {t("indexes.stop")}
          </Button>
          <Button type="button" disabled={startLoading()} onClick={start}>
            {t("indexes.start")}
          </Button>
        </>
      }
    >
      <Show when={progress()}>
        {(p) => (
          <div class="flex flex-wrap items-center gap-x-6 gap-y-2 py-3 text-sm">
            <span>
              {t("indexes.task_status")}:{" "}
              <Badge variant={p().is_done ? "secondary" : "success"}>
                {p().is_done ? t("indexes.idle") : t("indexes.running")}
              </Badge>
            </span>
            <span>
              {t("indexes.obj_count")}:{" "}
              <Badge variant="outline">{p().obj_count}</Badge>
            </span>
          </div>
        )}
      </Show>
      <FieldRenderer
        field={{
          id: "scan_path",
          type: Type.String,
          labelKey: "indexes.path_to_scan",
          picker: "path",
        }}
        value={scanPath()}
        onChange={(raw) => setScanPath(String(raw))}
      />
      <FieldRenderer
        field={{
          id: "scan_rate_limit",
          type: Type.Float,
          labelKey: "indexes.rate_limit",
        }}
        value={rateLimit()}
        onChange={(raw) =>
          setRateLimit(driverFromRaw(Type.Float, raw) as number)
        }
      />
    </SettingsSection>
  )
}

export default Scan
