import { Index } from "solid-js"
import { Button } from "~/components/ui/button"
import {
  createDeleteConfirm,
  createSettingsGroup,
  DataState,
  FieldRenderer,
  settingField,
  SettingsForm,
  SettingsSection,
  settingFromRaw,
  settingValue,
} from "~/features/settings/form"
import { useManageTitle, useRouter, useT } from "~/hooks"
import { Group } from "~/types"

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
}

export interface CommonSettingsProps {
  group: Group
  /** Card heading when the group is embedded in a page of its own. */
  title?: string
}

/** A settings group as one card of fields with the page Save / Reset bar. */
const CommonSettings = (props: CommonSettingsProps) => {
  const t = useT()
  const { pathname } = useRouter()
  useManageTitle(`manage.sidemenu.${pathname().split("/").pop()}`)
  const g = createSettingsGroup(props.group)
  g.load()
  const item = () => GROUP_ITEM[props.group]
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
            {t("manage.load_default_setting")}
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
              (item() ? t(`settings.items.${item()}.title`) : t("manage.title"))
            }
            description={
              item() ? t(`settings.items.${item()}.description`) : undefined
            }
          >
            <Index each={g.settings}>
              {(row) => (
                <FieldRenderer
                  field={settingField(row())}
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
