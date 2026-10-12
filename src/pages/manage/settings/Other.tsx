import { createSignal, For, onMount } from "solid-js"
import { createStore } from "solid-js/store"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { DataState } from "~/components/ui/data-state"
import {
  FieldRenderer,
  SettingsSection,
  type FieldSpec,
} from "~/features/settings/form"
import { useFetch, useManageTitle, useT, useUtil } from "~/hooks"
import { Group, PResp, SettingItem, Type } from "~/types"
import { handleResp, notify, r } from "~/utils"

/** One input of a save endpoint: where it is stored, what it is sent as. */
interface OtherField {
  /** Backend setting key the value is loaded from. */
  key: string
  /** JSON property of the request body. */
  param: string
  /** DOM id (kept from the old page). */
  id: string
  labelKey: string
  type: Type
  picker?: FieldSpec["picker"]
}

/** A tool with its own "set_*" endpoint and its own Save. */
interface OtherSection {
  id: string
  titleKey: string
  endpoint: string
  fields: OtherField[]
  /** Toast text for the endpoint's reply. */
  report?: (reply: string, t: ReturnType<typeof useT>) => string
}

const text = (key: string, param: string, labelKey = `settings.${key}`) =>
  ({ key, param, id: key, labelKey, type: Type.String }) satisfies OtherField

const folder = (key: string, labelKey: string, id = key) =>
  ({
    key,
    param: "temp_dir",
    id,
    labelKey: `settings_other.${labelKey}`,
    type: Type.String,
    picker: "path",
  }) satisfies OtherField

const SECTIONS: OtherSection[] = [
  {
    id: "aria2",
    titleKey: "settings_other.aria2",
    endpoint: "set_aria2",
    fields: [text("aria2_uri", "uri"), text("aria2_secret", "secret")],
    report: (reply, t) => `${t("settings_other.aria2_version")} ${reply}`,
  },
  {
    id: "qbittorrent",
    titleKey: "settings_other.qbittorrent",
    endpoint: "set_qbit",
    fields: [
      text("qbittorrent_url", "url"),
      { ...text("qbittorrent_seedtime", "seedtime"), type: Type.Number },
    ],
  },
  {
    id: "transmission",
    titleKey: "settings_other.transmission",
    endpoint: "set_transmission",
    fields: [
      text("transmission_uri", "uri"),
      { ...text("transmission_seedtime", "seedtime"), type: Type.Number },
    ],
  },
  {
    id: "115",
    titleKey: "settings_other.115",
    endpoint: "set_115",
    fields: [folder("115_temp_dir", "115_temp_dir")],
  },
  {
    id: "115_open",
    titleKey: "settings_other.115_open",
    endpoint: "set_115_open",
    fields: [folder("115_open_temp_dir", "115_open_temp_dir")],
  },
  {
    id: "123_pan",
    titleKey: "settings_other.123_pan",
    endpoint: "set_123_pan",
    fields: [folder("123_pan_temp_dir", "123_temp_dir", "123_temp_dir")],
  },
  {
    id: "123_open",
    titleKey: "settings_other.123_open",
    endpoint: "set_123_open",
    fields: [
      folder("123_open_temp_dir", "123_open_temp_dir"),
      text(
        "123_open_callback_url",
        "callback_url",
        "settings_other.123_open_callback_url",
      ),
    ],
  },
  {
    id: "pikpak",
    titleKey: "settings_other.pikpak",
    endpoint: "set_pikpak",
    fields: [folder("pikpak_temp_dir", "pikpak_temp_dir")],
  },
  {
    id: "thunder",
    titleKey: "settings_other.thunder",
    endpoint: "set_thunder",
    fields: [folder("thunder_temp_dir", "thunder_temp_dir")],
  },
  {
    id: "thunder_browser",
    titleKey: "settings_other.thunder_browser",
    endpoint: "set_thunder_browser",
    fields: [folder("thunder_browser_temp_dir", "thunder_browser_temp_dir")],
  },
  {
    id: "thunderx",
    titleKey: "settings_other.thunderx",
    endpoint: "set_thunderx",
    fields: [
      folder("thunderx_temp_dir", "thunderX_temp_dir", "thunderX_temp_dir"),
    ],
  },
  {
    id: "guangyapan",
    titleKey: "settings_other.guangyapan",
    endpoint: "set_guangyapan",
    fields: [folder("guangyapan_temp_dir", "guangyapan_temp_dir")],
  },
]

const specOf = (f: OtherField): FieldSpec => ({
  id: f.id,
  type: f.type,
  labelKey: f.labelKey,
  picker: f.picker,
})

const OtherSettings = () => {
  const t = useT()
  useManageTitle("manage.sidemenu.other")
  const { copy } = useUtil()
  const [values, setValues] = createStore<Record<string, string>>({})
  const [token, setToken] = createSignal("")
  const [error, setError] = createSignal<string>()
  const [saving, setSaving] = createSignal<string>()

  const [loading, fetchList] = useFetch(
    (): PResp<SettingItem[]> =>
      r.get(`/admin/setting/list?groups=${Group.ARIA2},${Group.SINGLE}`),
    true,
  )
  const refresh = async () => {
    handleResp(
      await fetchList(),
      (data) => {
        setError(undefined)
        for (const section of SECTIONS)
          for (const f of section.fields)
            setValues(f.key, data.find((i) => i.key === f.key)?.value || "")
        setToken(data.find((i) => i.key === "token")?.value || "")
      },
      (message) => setError(message),
    )
  }
  onMount(refresh)

  const save = async (section: OtherSection) => {
    setSaving(section.id)
    const body = Object.fromEntries(
      section.fields.map((f) => [f.param, values[f.key] ?? ""]),
    )
    const resp: Awaited<PResp<string>> = await r.post(
      `/admin/setting/${section.endpoint}`,
      body,
    )
    setSaving(undefined)
    handleResp(resp, (reply) =>
      notify.success(section.report ? section.report(reply, t) : reply),
    )
  }

  const [resetting, resetToken] = useFetch((): PResp<string> =>
    r.post("/admin/setting/reset_token"),
  )

  return (
    <DataState loading={loading()} error={error()} onRetry={refresh}>
      <div class="flex flex-col gap-4">
        <For each={SECTIONS}>
          {(section) => (
            <SettingsSection
              id={section.id}
              title={t(section.titleKey)}
              actions={
                <Button
                  type="button"
                  disabled={saving() === section.id}
                  onClick={() => save(section)}
                >
                  {t("global.save")}
                </Button>
              }
            >
              <For each={section.fields}>
                {(f) => (
                  <FieldRenderer
                    field={specOf(f)}
                    value={values[f.key]}
                    onChange={(raw) => setValues(f.key, String(raw))}
                  />
                )}
              </For>
            </SettingsSection>
          )}
        </For>
        <SettingsSection
          id="token"
          title={t("settings.token")}
          description={t("settings.other_token")}
        >
          <div class="flex flex-col gap-3 py-3">
            <Input value={token()} readOnly aria-label={t("settings.token")} />
            <div class="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => copy(token())}
              >
                {t("settings_other.copy_token")}
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={resetting()}
                onClick={async () =>
                  handleResp(await resetToken(), (data) => {
                    notify.success(t("settings_other.reset_token_success"))
                    setToken(data)
                  })
                }
              >
                {t("settings_other.reset_token")}
              </Button>
            </div>
          </div>
        </SettingsSection>
      </div>
    </DataState>
  )
}

export default OtherSettings
