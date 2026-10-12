import { createMemo, createSignal, For, Show } from "solid-js"
import { createStore, reconcile } from "solid-js/store"
import { Alert, AlertDescription } from "~/components/ui/alert"
import { Button } from "~/components/ui/button"
import { DataState } from "~/components/ui/data-state"
import {
  driverDefault,
  driverField,
  driverFromRaw,
  FieldRenderer,
  SettingsForm,
  SettingsSection,
  type FieldSpec,
} from "~/features/settings/form"
import { useFetch, useRouter, useT } from "~/hooks"
import {
  Addition,
  DriverConfig,
  DriverItem,
  PResp,
  Storage,
  Type,
} from "~/types"
import { getTarget, handleResp, joinBase, notify, r } from "~/utils"
import { JsonDialog } from "./JsonDialog"

interface DriverInfo {
  common: DriverItem[]
  additional: DriverItem[]
  config: DriverConfig
}

type Drivers = Record<string, DriverInfo>

const ALERT_VARIANT = {
  info: "info",
  success: "success",
  warning: "warning",
  danger: "destructive",
  error: "destructive",
} as const

const AddOrEdit = () => {
  const t = useT()
  const { params, to } = useRouter()
  const { id } = params
  const [driversLoading, loadDrivers] = useFetch(
    (): PResp<Drivers> => r.get("/admin/driver/list"),
    true,
  )
  const [drivers, setDrivers] = createSignal<Drivers>({})
  const [storage, setStorage] = createStore<Storage>({} as Storage)
  const [addition, setAddition] = createStore<Addition>({})
  const [error, setError] = createSignal<string>()
  // JSON of the form as last loaded: "modified" means differing from it.
  const [baseline, setBaseline] = createSignal("")
  const snapshot = () => JSON.stringify({ storage, addition })
  const dirty = createMemo(() => snapshot() !== baseline())

  const [storageLoading, loadStorage] = useFetch(
    (): PResp<Storage> => r.get(`/admin/storage/get?id=${id}`),
    true,
  )
  const [driverLoading, loadDriver] = useFetch(
    (): PResp<DriverInfo> =>
      r.get(`/admin/driver/info?driver=${storage.driver}`),
    true,
  )

  const initAdd = async () => {
    setStorage(reconcile({} as Storage))
    setAddition(reconcile({}))
    handleResp(
      await loadDrivers(),
      (data) => {
        setError(undefined)
        setDrivers(data)
        setBaseline(snapshot())
      },
      setError,
    )
  }
  const initEdit = async () => {
    handleResp(
      await loadStorage(),
      async (storageData) => {
        setStorage(storageData)
        setAddition(reconcile(JSON.parse(storageData.addition)))
        handleResp(
          await loadDriver(),
          (driverData) => {
            setError(undefined)
            setDrivers({ [storage.driver]: driverData })
            setBaseline(snapshot())
          },
          setError,
        )
      },
      setError,
    )
  }
  const init = () => (id ? initEdit() : initAdd())
  init()

  const info = () => drivers()[storage.driver]
  const alertTone = createMemo(() => info()?.config.alert?.split("|")[0])

  /** What goes to the backend, and what Export shows. */
  const payload = () => ({
    ...getTarget(storage),
    addition: JSON.stringify(getTarget(addition)),
  })

  // Switching driver starts the form over from the new driver's defaults.
  const chooseDriver = (driver: string) => {
    const next = drivers()[driver]
    for (const item of next.common) {
      setStorage(
        item.name as keyof Storage,
        driverDefault(item.type, item.default) as never,
      )
    }
    setAddition(reconcile({}))
    for (const item of next.additional) {
      setAddition(item.name, driverDefault(item.type, item.default))
    }
    setStorage("driver", driver)
  }

  const [saving, setSaving] = createSignal(false)
  const save = async () => {
    if (!info()) return
    if (info().config.need_ms) {
      notify.info(t("manage.add_storage-tips"))
      window.open(joinBase("/@manage/messenger"), "_blank")
    }
    setSaving(true)
    const resp: Awaited<PResp<{ id: number }>> = await r.post(
      `/admin/storage/${id ? "update" : "create"}`,
      payload(),
    )
    setSaving(false)
    handleResp(
      resp,
      () => {
        notify.success(t("global.save_success"))
        to("/@manage/storages", false, { replace: true })
      },
      () => {
        // The storage may exist even though it failed to start.
        if (resp.data?.id) to(`/@manage/storages/edit/${resp.data.id}`)
      },
    )
  }

  const [exportOpen, setExportOpen] = createSignal(false)
  const [importOpen, setImportOpen] = createSignal(false)
  const importStorage = (text: string) => {
    try {
      const {
        id,
        disabled,
        modified,
        status,
        addition: add,
        ...rest
      }: Storage = JSON.parse(text)
      setStorage(rest as Partial<Storage>)
      setAddition(JSON.parse(add))
      setImportOpen(false)
      notify.success(t("storages.common.import_success"))
    } catch (e: any) {
      notify.error(`Invalid storage format: ${e.message}`)
    }
  }

  const driverSpec = (): FieldSpec => ({
    id: "driver",
    type: Type.Select,
    labelKey: "storages.common.driver",
    required: true,
    searchable: true,
    readonly: id !== undefined,
    options: (id ? [storage.driver] : Object.keys(drivers())).map((key) => ({
      value: key,
      labelKey: `drivers.drivers.${key}`,
    })),
  })

  const loading = () =>
    id ? storageLoading() || driverLoading() : driversLoading()

  return (
    <>
      <SettingsForm
        dirty={dirty()}
        saving={saving()}
        resetting={loading()}
        saveLabel={t(`global.${id ? "save" : "add"}`)}
        onSave={save}
        onReset={init}
        extra={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setExportOpen(true)}
            >
              {t("storages.common.export")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setImportOpen(true)}
            >
              {t("storages.common.import")}
            </Button>
          </>
        }
      >
        <DataState loading={loading()} error={error()} onRetry={init}>
          <SettingsSection
            id="storage-driver"
            title={t(`global.${id ? "edit" : "add"}`)}
          >
            <FieldRenderer
              field={driverSpec()}
              value={storage.driver}
              onChange={(raw) => chooseDriver(String(raw))}
            />
            <Show when={alertTone()}>
              <div class="py-3">
                <Alert
                  variant={
                    ALERT_VARIANT[alertTone() as keyof typeof ALERT_VARIANT] ??
                    "info"
                  }
                >
                  <AlertDescription>
                    {t(`drivers.config.${storage.driver}.alert`)}
                  </AlertDescription>
                </Alert>
              </div>
            </Show>
          </SettingsSection>
          <Show when={info()}>
            <SettingsSection
              id="storage-common"
              title={t("settings.form.storage_common")}
            >
              <For each={info().common}>
                {(item) => (
                  <FieldRenderer
                    field={driverField(item, "common")}
                    value={
                      (storage as unknown as Record<string, never>)[item.name]
                    }
                    onChange={(raw) =>
                      setStorage(
                        item.name as keyof Storage,
                        driverFromRaw(item.type, raw) as never,
                      )
                    }
                  />
                )}
              </For>
            </SettingsSection>
            <Show when={info().additional.length > 0}>
              <SettingsSection
                id="storage-additional"
                title={t("settings.form.storage_driver", {
                  driver: t(`drivers.drivers.${storage.driver}`),
                })}
              >
                <For each={info().additional}>
                  {(item) => (
                    <FieldRenderer
                      field={driverField(item, storage.driver)}
                      value={addition[item.name]}
                      onChange={(raw) =>
                        setAddition(item.name, driverFromRaw(item.type, raw))
                      }
                    />
                  )}
                </For>
              </SettingsSection>
            </Show>
          </Show>
        </DataState>
      </SettingsForm>
      <JsonDialog
        open={exportOpen()}
        onOpenChange={setExportOpen}
        title={t("storages.common.export_title")}
        tips={t("storages.common.export_tips")}
        value={JSON.stringify(payload())}
      />
      <JsonDialog
        open={importOpen()}
        onOpenChange={setImportOpen}
        title={t("storages.common.import_title")}
        tips={t("storages.common.import_tips")}
        onSubmit={importStorage}
      />
    </>
  )
}

export default AddOrEdit
