import { Badge } from "~/components/ui/badge"
import { SimpleSelect } from "~/components/ui/simple-select"
import { SwitchField } from "~/components/ui/toggle-field"
import { createSignal, For, onMount, Show } from "solid-js"
import { FaSolidPuzzlePiece } from "solid-icons/fa"
import { useFetch, useManageTitle, useRouter, useT } from "~/hooks"
import { PluginConfigField, PluginItem, Resp } from "~/types"
import { handleResp, notify, pluginEngine, r } from "~/utils"
import { MaybeLoading } from "~/components"
import { Input, Textarea } from "~/components/ui/input"
import { Button } from "~/components/ui/button"

const ConfigPlugin = () => {
  const t = useT()
  const { params, back, to } = useRouter()
  const id = decodeURIComponent(params.id || "")
  useManageTitle("plugins.config_modal.title")

  const [plugin, setPlugin] = createSignal<PluginItem | null>(null)
  const [formValues, setFormValues] = createSignal<Record<string, any>>({})
  const [highPrivilege, setHighPrivilege] = createSignal(false)
  const [enabled, setEnabled] = createSignal(true)
  const [saving, setSaving] = createSignal(false)

  const [fetchLoading, fetchPlugin] = useFetch((): Promise<Resp<PluginItem>> =>
    r.get(`/admin/plugin/get?id=${encodeURIComponent(id)}`),
  )

  const initData = async () => {
    const resp = await fetchPlugin()
    handleResp(
      resp,
      (data) => {
        setPlugin(data)
        setHighPrivilege(!!data.high_privilege)
        setEnabled(!!data.enabled)
        const initial: Record<string, any> = {}
        if (data.config_schema) {
          data.config_schema.forEach((field) => {
            if (
              data.config_values &&
              data.config_values[field.key] !== undefined
            ) {
              initial[field.key] = data.config_values[field.key]
            } else if (field.defaultValue !== undefined) {
              initial[field.key] = field.defaultValue
            }
          })
        }
        setFormValues(initial)
      },
      (msg) => {
        notify.error("Plugin not found: " + msg)
        back()
      },
    )
  }

  onMount(() => {
    if (id) {
      initData()
    }
  })

  const handleFieldChange = (key: string, value: any) => {
    setFormValues((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  const handleSave = async () => {
    const p = plugin()
    if (!p) return
    setSaving(true)
    try {
      const resp: Resp<PluginItem> = await r.post("/admin/plugin/update", {
        id: p.id,
        config_values: formValues(),
        high_privilege: highPrivilege(),
        enabled: enabled(),
      })
      handleResp(resp, (updated) => {
        if (updated.enabled) {
          pluginEngine.loadPlugin(updated)
        } else {
          pluginEngine.unloadPlugin(updated.id)
        }
        notify.success(t("global.save_success"))
        to("/@manage/plugins")
      })
    } finally {
      setSaving(false)
    }
  }

  const renderFieldInput = (field: PluginConfigField) => {
    const value = () => formValues()[field.key]

    switch (field.type) {
      case "string":
        return (
          <Input
            class="w-full max-w-2xl"
            id={field.key}
            value={value() || ""}
            onInput={(e: any) => handleFieldChange(field.key, e.target.value)}
          />
        )
      case "number":
        return (
          <Input
            class="w-full max-w-sm"
            id={field.key}
            type="number"
            value={value() ?? 0}
            onInput={(e: any) =>
              handleFieldChange(field.key, parseFloat(e.target.value) || 0)
            }
          />
        )
      case "bool":
        return (
          <div class="flex flex-row items-center py-1 gap-x-2">
            <SwitchField
              id={field.key}
              checked={!!value()}
              onChange={(on) => handleFieldChange(field.key, on)}
            />
            <Badge variant={value() ? "success" : "secondary"}>
              {t(`global.${value() ? "enable" : "disable"}`)}
            </Badge>
          </div>
        )
      case "select":
        return (
          <SimpleSelect
            class="w-full max-w-2xl"
            options={(field.options || []).map((o) => ({ value: o, label: o }))}
            value={String(value() ?? field.options?.[0] ?? "")}
            onChange={(val) => handleFieldChange(field.key, val)}
          />
        )
      case "text":
        return (
          <Textarea
            class="w-full max-w-2xl"
            id={field.key}
            rows={4}
            value={value() || ""}
            onInput={(e: any) => handleFieldChange(field.key, e.target.value)}
          />
        )
      default:
        return (
          <Input
            class="w-full max-w-2xl"
            id={field.key}
            value={value() || ""}
            onInput={(e: any) => handleFieldChange(field.key, e.target.value)}
          />
        )
    }
  }

  return (
    <MaybeLoading loading={fetchLoading()}>
      <div class="flex flex-col items-start w-full max-w-3xl gap-y-5">
        <h2 class="font-semibold mb-1">{t("plugins.config_modal.title")}</h2>

        {/* Plugin Info Banner */}
        <Show when={plugin()}>
          <div class="w-full max-w-2xl p-4 rounded-md border border-border bg-background">
            <div class="flex flex-row items-center gap-x-3">
              <div class="w-10 h-10 rounded-md bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                <Show
                  when={plugin()?.icon}
                  fallback={<FaSolidPuzzlePiece class="size-5" />}
                >
                  <img
                    src={plugin()?.icon}
                    alt="plugin icon"
                    style={{
                      width: "24px",
                      height: "24px",
                      "object-fit": "contain",
                    }}
                  />
                </Show>
              </div>
              <div class="flex-col items-start flex-1 gap-y-0.5">
                <div class="flex flex-row items-center flex-wrap gap-x-2">
                  <p class="font-bold text-base">{plugin()?.name}</p>
                  <Badge variant="info">v{plugin()?.version}</Badge>
                  <Badge variant="secondary">{plugin()?.type || "ui"}</Badge>
                </div>
                <p class="text-xs text-muted-foreground">
                  {plugin()?.description || t("plugins.empty_desc")}
                </p>
              </div>
            </div>
          </div>
        </Show>

        {/* Plugin Enable State */}
        <div class="relative w-full flex flex-col items-start gap-1.5">
          <label
            class="inline-block mb-1 text-sm leading-5 font-medium text-foreground"
            for="plugin_enable"
          >
            {t("global.enable")}
          </label>
          <div class="flex flex-row items-center gap-x-2">
            <SwitchField
              id="plugin_enable"
              checked={enabled()}
              onChange={setEnabled}
            />
            <Badge variant={enabled() ? "success" : "secondary"}>
              {t(`global.${enabled() ? "enable" : "disable"}`)}
            </Badge>
          </div>
        </div>

        {/* High Privilege Switch */}
        <div class="relative w-full flex flex-col items-start gap-1.5">
          <label
            class="inline-block mb-1 text-sm leading-5 font-medium text-foreground"
            for="plugin_high_privilege"
          >
            {t("plugins.install_modal.high_privilege_label")}
          </label>
          <div class="flex flex-row items-center gap-x-2">
            <SwitchField
              id="plugin_high_privilege"
              checked={highPrivilege()}
              onChange={setHighPrivilege}
            />
            <Show when={highPrivilege()}>
              <Badge variant="danger">Root Access</Badge>
            </Show>
          </div>
          <p class="mt-0.5 inline-block text-xs leading-5 text-muted-foreground">
            {t("plugins.install_modal.high_privilege_help")}
          </p>
        </div>

        {/* Dynamic Config Schema Form */}
        <Show
          when={plugin()?.config_schema && plugin()!.config_schema!.length > 0}
          fallback={
            <div class="py-2">
              <p class="text-sm text-muted-foreground">
                {t("plugins.config_modal.no_config")}
              </p>
            </div>
          }
        >
          <For each={plugin()?.config_schema}>
            {(field) => (
              <div class="relative w-full flex flex-col items-start gap-1.5">
                <label
                  class="inline-block mb-1 text-sm leading-5 font-medium text-foreground"
                  for={field.key}
                >
                  {field.label}
                </label>
                {renderFieldInput(field)}
                <Show when={field.description}>
                  <p class="mt-0.5 inline-block text-xs leading-5 text-muted-foreground">
                    {field.description}
                  </p>
                </Show>
              </div>
            )}
          </For>
        </Show>

        {/* Operations */}
        <div class="flex flex-row items-center mt-2 gap-x-2">
          <Button variant="subtle" loading={saving()} onClick={handleSave}>
            {t("global.save")}
          </Button>
          <Button variant="secondary" onClick={() => back()}>
            {t("global.back")}
          </Button>
        </div>
      </div>
    </MaybeLoading>
  )
}

export default ConfigPlugin
