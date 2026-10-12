// Load / edit / save one group of /admin/setting rows. Common settings pages,
// the S3 page and the index settings all work this way, so this is the only
// place that knows the endpoints and when a page counts as modified.
import { createMemo, createSignal } from "solid-js"
import { createStore, reconcile } from "solid-js/store"
import { useFetch, useT } from "~/hooks"
import { setSettings as renewSettings } from "~/store"
import { EmptyResp, Group, PEmptyResp, PResp, Resp, SettingItem } from "~/types"
import {
  getTarget,
  handleResp,
  handleRespWithoutAuthAndNotify,
  notify,
  r,
} from "~/utils"

export const createSettingsGroup = (group: Group) => {
  const t = useT()
  const [settings, setItems] = createStore<SettingItem[]>([])
  // JSON of the rows as last loaded or saved: "modified" means differing from it.
  const [baseline, setBaseline] = createSignal("[]")
  const [error, setError] = createSignal<string>()

  const [loading, fetchList] = useFetch(
    (): PResp<SettingItem[]> => r.get(`/admin/setting/list?group=${group}`),
    true,
  )
  const [saving, post] = useFetch((): PEmptyResp =>
    r.post("/admin/setting/save", getTarget(settings)),
  )
  const [, fetchDefaults] = useFetch((): PResp<SettingItem[]> =>
    r.post(`/admin/setting/default?group=${group}`),
  )

  const snapshot = () => JSON.stringify(getTarget(settings))
  const dirty = createMemo(() => JSON.stringify(settings) !== baseline())

  const load = async () => {
    const resp = await fetchList()
    handleResp(
      resp,
      (data) => {
        setError(undefined)
        setItems(reconcile(data, { key: "key" }))
        setBaseline(JSON.stringify(data))
      },
      (message) => setError(message),
    )
  }

  /** Posts the whole list; true when the backend accepted it. */
  const save = async (): Promise<boolean> => {
    let saved = false
    handleResp(await post(), () => {
      saved = true
    })
    if (!saved) return false
    notify.success(t("global.save_success"))
    setBaseline(snapshot())
    handleRespWithoutAuthAndNotify(
      (await r.get("/public/settings")) as Resp<Record<string, string>>,
      renewSettings,
    )
    return true
  }

  /** Fills the form with the defaults; nothing is saved until Save. */
  const loadDefaults = async () => {
    const resp = await fetchDefaults()
    handleResp(resp, (data) => {
      notify.info(t("manage.load_default_setting_success"))
      setItems(data)
    })
  }

  const set = (key: string, value: string) =>
    setItems((i) => i.key === key, "value", value)

  const value = (key: string) => settings.find((i) => i.key === key)?.value

  /** Drops a deprecated setting on the backend and reloads the list. */
  const remove = async (key: string) => {
    const resp: EmptyResp = await r.post(`/admin/setting/delete?key=${key}`)
    handleResp(resp, () => {
      notify.success(t("global.delete_success"))
      return load()
    })
  }

  return {
    settings,
    loading,
    saving,
    error,
    dirty,
    load,
    save,
    loadDefaults,
    set,
    value,
    remove,
  }
}

export type SettingsGroup = ReturnType<typeof createSettingsGroup>
