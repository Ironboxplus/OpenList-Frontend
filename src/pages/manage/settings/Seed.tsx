import { For, JSXElement, Show, createSignal } from "solid-js"
import { MaybeLoading } from "~/components"
import { useFetch, useManageTitle, useT } from "~/hooks"
import { Group, PResp, SettingItem } from "~/types"
import { handleResp, notify, r } from "~/utils"
import { Input } from "~/components/ui/input"
import { Button } from "~/components/ui/button"
import { SimpleSelect } from "~/components/ui/simple-select"
import { CheckboxField, SwitchField } from "~/components/ui/toggle-field"

type SeedAlgorithm = "md5" | "sha1" | "sha256"
type SeedFormat = "oss" | "torrent" | "cas"

type SeedHashScope = { whole: boolean; pieces: boolean }
type SeedHashMatrix = Record<SeedAlgorithm, SeedHashScope>
type SeedFormatPolicies = Record<SeedFormat, "on" | "off">

const ALGORITHMS: SeedAlgorithm[] = ["md5", "sha1", "sha256"]
const FORMATS: SeedFormat[] = ["oss", "torrent", "cas"]

const ALGORITHM_LABELS: Record<SeedAlgorithm, string> = {
  md5: "MD5",
  sha1: "SHA-1",
  sha256: "SHA-256",
}

const defaultMatrix = (): SeedHashMatrix => ({
  md5: { whole: true, pieces: false },
  sha1: { whole: true, pieces: false },
  sha256: { whole: true, pieces: false },
})

const defaultPolicies = (): SeedFormatPolicies => ({
  oss: "off",
  torrent: "off",
  cas: "off",
})

const SEED_KEYS = [
  "seed_site_url",
  "seed_default_matrix",
  "seed_format_policies",
  "seed_default_format",
  "seed_auto_generate_policy",
  "seed_single_direct_preview",
  "seed_cas_direct_access",
]

const Section = (props: {
  title: string
  description?: string
  children: JSXElement
}) => {
  return (
    <div class="w-full border border-border rounded-lg bg-muted p-4">
      <h2 class="font-semibold mb-1 text-lg leading-7">{props.title}</h2>
      <Show when={props.description}>
        <p class="text-sm text-muted-foreground mb-3">{props.description}</p>
      </Show>
      {props.children}
    </div>
  )
}

const ToggleRow = (props: {
  label: string
  description?: string
  checked: boolean
  onChange: (checked: boolean) => void
}) => {
  return (
    <div class="flex w-full gap-4 py-2 items-center justify-between">
      <div class="flex flex-col items-start gap-y-1">
        <p class="font-medium">{props.label}</p>
        <Show when={props.description}>
          <p class="text-xs text-muted-foreground">{props.description}</p>
        </Show>
      </div>
      <SwitchField
        class="shrink-0"
        aria-label={props.label}
        checked={props.checked}
        onChange={props.onChange}
      />
    </div>
  )
}

const SeedSettings = () => {
  const t = useT()
  useManageTitle("manage.sidemenu.seed")

  const [items, setItems] = createSignal<SettingItem[]>([])
  const [siteUrl, setSiteUrl] = createSignal("")
  const [matrix, setMatrix] = createSignal<SeedHashMatrix>(defaultMatrix())
  const [policies, setPolicies] =
    createSignal<SeedFormatPolicies>(defaultPolicies())
  const [defaultFormat, setDefaultFormat] = createSignal<SeedFormat>("oss")
  const [autoGenerate, setAutoGenerate] = createSignal(false)
  const [singlePreview, setSinglePreview] = createSignal(false)
  const [casDirect, setCasDirect] = createSignal(false)

  const setHashScope = (
    algorithm: SeedAlgorithm,
    scope: keyof SeedHashScope,
    checked: boolean,
  ) => {
    setMatrix({
      ...matrix(),
      [algorithm]: { ...matrix()[algorithm], [scope]: checked },
    })
  }

  const setPolicy = (format: SeedFormat, enabled: boolean) => {
    setPolicies({ ...policies(), [format]: enabled ? "on" : "off" })
  }

  const [loading, getSettings] = useFetch((): PResp<SettingItem[]> =>
    r.get(`/admin/setting/list?group=${Group.GLOBAL}`),
  )

  const refresh = async () => {
    const resp = await getSettings()
    handleResp(resp, (data) => {
      const seedItems = data.filter((item) => SEED_KEYS.includes(item.key))
      setItems(seedItems)
      const values: Record<string, string> = {}
      seedItems.forEach((item) => (values[item.key] = item.value))

      setSiteUrl(values.seed_site_url ?? "")
      setDefaultFormat((values.seed_default_format as SeedFormat) || "oss")
      setAutoGenerate(values.seed_auto_generate_policy === "on")
      setSinglePreview(values.seed_single_direct_preview === "true")
      setCasDirect(values.seed_cas_direct_access === "true")

      const parsed = defaultMatrix()
      try {
        const raw = JSON.parse(values.seed_default_matrix || "{}")
        ALGORITHMS.forEach((algorithm) => {
          parsed[algorithm] = {
            whole: raw?.[algorithm]?.whole ?? parsed[algorithm].whole,
            pieces: raw?.[algorithm]?.pieces ?? parsed[algorithm].pieces,
          }
        })
      } catch (_) {
        // keep defaults on malformed payloads
      }
      setMatrix(parsed)

      const parsedPolicies = defaultPolicies()
      try {
        const raw = JSON.parse(values.seed_format_policies || "{}")
        FORMATS.forEach((format) => {
          parsedPolicies[format] = raw?.[format] === "on" ? "on" : "off"
        })
      } catch (_) {
        // keep defaults on malformed payloads
      }
      setPolicies(parsedPolicies)
    })
  }
  refresh()

  const [saveLoading, saveSettings] = useFetch((): PResp<string> => {
    const values: Record<string, string> = {
      seed_site_url: siteUrl().trim(),
      seed_default_matrix: JSON.stringify(matrix()),
      seed_format_policies: JSON.stringify(policies()),
      seed_default_format: defaultFormat(),
      seed_auto_generate_policy: autoGenerate() ? "on" : "off",
      seed_single_direct_preview: singlePreview() ? "true" : "false",
      seed_cas_direct_access: casDirect() ? "true" : "false",
    }
    // Reuse the persisted metadata so type/group/flag are never overwritten.
    const payload = items()
      .filter((item) => values[item.key] !== undefined)
      .map((item) => ({ ...item, value: values[item.key] }))
    return r.post("/admin/setting/save", payload)
  })

  return (
    <MaybeLoading loading={loading()}>
      <div class="flex flex-col w-full items-stretch gap-y-4">
        <Section title={t("settings_seed.site_config")}>
          <div class="relative w-full">
            <label
              class="inline-block mb-1 text-sm leading-5 font-medium text-foreground"
              for="seed_site_url"
            >
              {t("settings_seed.site_url")}
            </label>
            <Input
              id="seed_site_url"
              placeholder="https://example.com"
              value={siteUrl()}
              onInput={(e) => setSiteUrl(e.currentTarget.value)}
            />
            <p class="inline-block mt-1 text-sm leading-5 text-muted-foreground">
              {t("settings_seed.site_url_help")}
            </p>
          </div>
        </Section>

        <Section
          title={t("settings_seed.default_matrix")}
          description={t("settings_seed.default_matrix_help")}
        >
          <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
            <For each={ALGORITHMS}>
              {(algorithm) => (
                <div class="flex flex-col items-start border border-border rounded-md bg-canvas p-3 gap-y-1">
                  <p class="font-semibold">{ALGORITHM_LABELS[algorithm]}</p>
                  <CheckboxField
                    checked={matrix()[algorithm].whole}
                    onChange={(on) => setHashScope(algorithm, "whole", on)}
                  >
                    {t("settings_seed.whole")}
                  </CheckboxField>
                  <CheckboxField
                    checked={matrix()[algorithm].pieces}
                    onChange={(on) => setHashScope(algorithm, "pieces", on)}
                  >
                    {t("settings_seed.pieces")}
                  </CheckboxField>
                </div>
              )}
            </For>
          </div>
        </Section>

        <Section
          title={t("settings_seed.format_policies")}
          description={t("settings_seed.format_policies_help")}
        >
          <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
            <For each={FORMATS}>
              {(format) => (
                <div class="flex border border-border rounded-md bg-canvas p-3 gap-2 items-center justify-between">
                  <p class="font-medium">
                    {t(`settings_seed.${format}_format`)}
                  </p>
                  <SwitchField
                    class="shrink-0"
                    aria-label={t(`settings_seed.${format}_format`)}
                    checked={policies()[format] === "on"}
                    onChange={(on) => setPolicy(format, on)}
                  />
                </div>
              )}
            </For>
          </div>
          <div class="relative mt-4 w-full md:w-56">
            <label
              class="inline-block mb-1 text-sm leading-5 font-medium text-foreground"
              for="seed_default_format"
            >
              {t("settings_seed.default_format")}
            </label>
            <SimpleSelect
              class="w-full"
              options={FORMATS.map((format) => ({
                value: format,
                label: t(`settings.seed_default_formats.${format}`),
              }))}
              value={defaultFormat()}
              onChange={(value) => setDefaultFormat(value as SeedFormat)}
            />
            <p class="inline-block mt-1 text-sm leading-5 text-muted-foreground">
              {t("settings_seed.default_format_help")}
            </p>
          </div>
        </Section>

        <Section title={t("settings_seed.other_options")}>
          <div class="flex flex-col w-full items-stretch gap-y-1">
            <ToggleRow
              label={t("settings_seed.auto_generate")}
              description={t("settings_seed.auto_generate_help")}
              checked={autoGenerate()}
              onChange={setAutoGenerate}
            />
            <ToggleRow
              label={t("settings_seed.single_direct_preview")}
              description={t("settings_seed.single_direct_preview_help")}
              checked={singlePreview()}
              onChange={setSinglePreview}
            />
            <ToggleRow
              label={t("settings_seed.cas_direct_access")}
              description={t("settings_seed.cas_direct_access_help")}
              checked={casDirect()}
              onChange={setCasDirect}
            />
          </div>
        </Section>

        <div class="flex flex-row items-center gap-x-2">
          <Button
            variant="subtle"
            loading={saveLoading()}
            onClick={async () => {
              const resp = await saveSettings()
              handleResp(resp, () => {
                notify.success(t("global.save_success"))
                refresh()
              })
            }}
          >
            {t("global.save")}
          </Button>
          <Button
            variant="secondary"
            loading={loading()}
            onClick={() => refresh()}
          >
            {t("global.refresh")}
          </Button>
        </div>
      </div>
    </MaybeLoading>
  )
}

export default SeedSettings
