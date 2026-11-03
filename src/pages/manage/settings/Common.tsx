import { createMemo, Index } from "solid-js"
import { Button } from "~/components/ui/button"
import { DataState } from "~/components/ui/data-state"
import {
  createDeleteConfirm,
  createSettingsGroup,
  FieldRenderer,
  settingField,
  SettingsForm,
  SettingsSection,
  settingFromRaw,
  settingValue,
} from "~/features/settings/form"
import { useManageTitle, useRouter, useT } from "~/hooks"
import { Group, type SettingItem } from "~/types"

/** Which registry entry names the card of each group. */
const GROUP_ITEM: Partial<Record<Group, string>> = {
  [Group.SITE]: "site",
  [Group.STYLE]: "style",
  [Group.PREVIEW]: "preview",
  [Group.GLOBAL]: "global",
  [Group.SSO]: "sso",
  [Group.LDAP]: "ldap",
  [Group.FTP]: "ftp",
  [Group.TRAFFIC]: "traffic",
  [Group.S3]: "s3",
  [Group.TRANSCODE]: "media-transcode",
}

export interface CommonSettingsProps {
  group: Group
  /** Card heading when the group is embedded in a page of its own. */
  title?: string
  /**
   * Render only these settings, in this order (default: the whole group). Lets
   * one backend group be split over several pages; the page then supplies its
   * own heading, so the card has none.
   */
  keys?: string[]
  /** Whether a setting is read-only given the current values of the group. */
  readOnlyKey?: (key: string, all: SettingItem[]) => boolean
}

/** A settings group as one card of fields with the page Save / Reset bar. */
const CommonSettings = (props: CommonSettingsProps) => {
  const t = useT()
  const { pathname } = useRouter()
  if (!props.keys) {
    useManageTitle(`manage.sidemenu.${pathname().split("/").pop()}`)
  }
  const g = createSettingsGroup(props.group)
  g.load()
  const item = () => GROUP_ITEM[props.group]
  const visible = createMemo(() => {
    if (!props.keys) return g.settings
    const byKey = new Map(g.settings.map((row) => [row.key, row]))
    return props.keys
      .map((key) => byKey.get(key))
      .filter((row): row is SettingItem => !!row)
  })
  const removal = createDeleteConfirm<string>({
    name: (key) => t(`settings.${key}`),
    run: g.remove,
  })
  return (
    <>
      <SettingsForm
        dirty={g.dirty()}
        saving={g.saving()}
        resetting={g.loading()}
        onSave={g.save}
        onReset={g.load}
        extra={
          <Button
            type="button"
            variant="secondary"
            disabled={g.loading() || g.saving()}
            onClick={g.loadDefaults}
          >
            {t("settings.form.load_default")}
          </Button>
        }
      >
        <DataState
          loading={g.loading()}
          error={g.error()}
          empty={g.settings.length === 0}
          onRetry={g.load}
        >
          <SettingsSection
            id={`group-${props.group}`}
            title={
              props.title ??
              (props.keys
                ? undefined
                : item()
                  ? t(`settings.items.${item()}.title`)
                  : t("manage.title"))
            }
            description={
              item() && !props.keys
                ? t(`settings.items.${item()}.description`)
                : undefined
            }
          >
            <Index each={visible()}>
              {(row) => (
                <FieldRenderer
                  field={{
                    ...settingField(row()),
                    readonly:
                      settingField(row()).readonly ||
                      props.readOnlyKey?.(row().key, g.settings),
                  }}
                  value={settingValue(row())}
                  onChange={(raw) => g.set(row().key, settingFromRaw(raw))}
                  onDelete={() => removal.ask(row().key)}
                />
              )}
            </Index>
          </SettingsSection>
        </DataState>
      </SettingsForm>
      {removal.dialog()}
    </>
  )
}

export default CommonSettings
