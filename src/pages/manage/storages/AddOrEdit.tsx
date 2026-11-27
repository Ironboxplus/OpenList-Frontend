import { createEffect, createMemo, createSignal, For, on, Show } from "solid-js"
import { createStore, reconcile } from "solid-js/store"
import { AdvancedGroup } from "~/components/ui/advanced-group"
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
  type FieldRaw,
  type FieldSpec,
  type FieldValue,
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

/**
 * A section of driver items: those in `inSight` (`<part>:<name>`) in line,
 * the others under Advanced, counted when no longer at their default.
 */
const ItemSection = (props: {
  id: string
  part: "common" | "additional"
  title: string
  items: DriverItem[]
  inSight: Set<string>
  atDefault: (item: DriverItem, value: unknown) => boolean
  value: (item: DriverItem) => unknown
  field: (item: DriverItem) => FieldSpec
  onChange: (item: DriverItem, raw: FieldRaw) => void
  /** The item a link led to: its fold opens and it is marked. */
  focus?: string
}) => {
  const t = useT()
  const shown = (item: DriverItem) =>
    props.inSight.has(`${props.part}:${item.name}`)
  const inline = createMemo(() => props.items.filter(shown))
  const folded = createMemo(() => props.items.filter((i) => !shown(i)))
  const changed = () =>
    folded().filter((i) => !props.atDefault(i, props.value(i))).length
  const [open, setOpen] = createSignal(false)
  // the form was filled again: what differs is in sight, fold the rest, but
  // for the item a link led to
  createEffect(
    on(
      () => props.inSight,
      () => {
        setOpen(folded().some((i) => i.name === props.focus))
        if (props.items.some((i) => i.name === props.focus))
          requestAnimationFrame(() =>
            document
              .querySelector(`[data-field="${props.focus}"]`)
              ?.scrollIntoView?.({ block: "center" }),
          )
      },
    ),
  )
  const Item = (p: { item: DriverItem }) => (
    <FieldRenderer
      field={props.field(p.item)}
      value={props.value(p.item) as FieldValue}
      focused={props.focus === p.item.name}
      onChange={(raw) => props.onChange(p.item, raw)}
    />
  )
  return (
    <SettingsSection id={props.id} title={props.title}>
      <For each={inline()}>{(item) => <Item item={item} />}</For>
      <Show when={folded().length > 0}>
        <div class="py-2">
          <AdvancedGroup
            title={t("global.advanced")}
            count={folded().length}
            changed={changed()}
            open={open()}
            onOpenChange={setOpen}
            testid={`advanced-storage-${props.part}`}
          >
            <For each={folded()}>{(item) => <Item item={item} />}</For>
          </AdvancedGroup>
        </div>
      </Show>
    </SettingsSection>
  )
}

const AddOrEdit = () => {
  const t = useT()
  const { params, to, searchParams } = useRouter()
  const { id } = params
  // the item a link led to (Transfer settings' connections per file)
  const focus = () => {
    const f = searchParams?.focus
    return Array.isArray(f) ? f[0] : f
  }
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
        placeItems()
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
            placeItems()
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

  // Required items and the ones not at their default are in sight, the rest
  // of each section folded (PLAN_FE_SYSTEM_UX_1127 P3; research 05 §一: the
  // driver Item has Default and Required, no advanced flag yet). Decided when
  // the form is filled, so an item does not jump out of the fold as it is edited.
  const commonValue = (item: DriverItem) =>
    (storage as unknown as Record<string, unknown>)[item.name]
  const atDefault = (item: DriverItem, value: unknown) =>
    value === undefined ||
    value === null ||
    String(value) === String(driverDefault(item.type, item.default))
  const [inSight, setInSight] = createSignal(new Set<string>())
  const placeItems = () => {
    const d = info()
    if (!d) return setInSight(new Set<string>())
    const shown = (items: DriverItem[], value: (i: DriverItem) => unknown) =>
      items
        .filter((i) => i.required || !atDefault(i, value(i)))
        .map((i) => i.name)
    setInSight(
      new Set([
        ...shown(d.common, commonValue).map((n) => `common:${n}`),
        ...shown(d.additional, (i) => addition[i.name]).map(
          (n) => `additional:${n}`,
        ),
      ]),
    )
  }

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
    placeItems()
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
      placeItems()
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
            <ItemSection
              id="storage-common"
              part="common"
              title={t("settings.form.storage_common")}
              items={info().common}
              inSight={inSight()}
              atDefault={atDefault}
              value={commonValue}
              field={(item) => driverField(item, "common")}
              focus={focus()}
              onChange={(item, raw) =>
                setStorage(
                  item.name as keyof Storage,
                  driverFromRaw(item.type, raw) as never,
                )
              }
            />
            <Show when={info().additional.length > 0}>
              <ItemSection
                id="storage-additional"
                part="additional"
                title={t("settings.form.storage_driver", {
                  driver: t(`drivers.drivers.${storage.driver}`),
                })}
                items={info().additional}
                inSight={inSight()}
                atDefault={atDefault}
                value={(item) => addition[item.name]}
                field={(item) => driverField(item, storage.driver)}
                focus={focus()}
                onChange={(item, raw) =>
                  setAddition(item.name, driverFromRaw(item.type, raw))
                }
              />
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
